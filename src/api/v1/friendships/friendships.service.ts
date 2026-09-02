import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { subject } from '@casl/ability';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { accessibleBy, type AppAbility } from 'src/casl/casl-prisma';
import type { Friendship, Prisma, User } from 'src/generated/prisma/client';
import { FriendshipStatus } from 'src/generated/prisma/enums';
import { canonicalPair } from 'src/friendship/friendship.pair';
import { NotificationService } from 'src/notification/notification.service';
import { selectOf, type AssertColumns } from '../common/select';
import {
  assertLimitAllowed,
  assertPageWithin,
  pageMeta,
} from '../common/pagination';
import { skipFor } from '../common/schemas/api-pagination.schema';
import {
  ApiUserSummarySchema,
  type ApiUserSummaryDTO,
} from '../common/schemas/api-users.schema';
import { matching, parties } from './friendships.presentation';
import {
  ApiFriendshipColumnsSchema,
  ApiFriendshipPageSchema,
  ApiFriendshipSchema,
  type ApiFriendshipColumnsDTO,
  type ApiFriendshipCreateDTO,
  type ApiFriendshipDTO,
  type ApiFriendshipPageDTO,
  type ApiFriendshipQueryDTO,
  type ApiFriendshipUpdateDTO,
} from '../common/schemas/api-friendships.schema';

const PARTY_SELECT = { select: selectOf(ApiUserSummarySchema) };

export const FRIENDSHIP_SELECT = {
  ...selectOf(ApiFriendshipColumnsSchema),
  userAId: true,
  userBId: true,
  addresseeId: true,
  deletedAt: true,
  userA: PARTY_SELECT,
  userB: PARTY_SELECT,
} satisfies Prisma.FriendshipSelect;

export const COLUMNS_MATCH_MODEL: AssertColumns<
  ApiFriendshipColumnsDTO,
  Friendship
> = true;
export const PARTY_MATCHES_MODEL: AssertColumns<ApiUserSummaryDTO, User> = true;

type StoredFriendship = Prisma.FriendshipGetPayload<{
  select: typeof FRIENDSHIP_SELECT;
}>;

@Injectable()
export class ApiFriendshipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilityFactory: CaslAbilityFactory,
    private readonly notifications: NotificationService,
  ) {}

  async findAllFriendships(
    query: ApiFriendshipQueryDTO,
    caller: User,
  ): Promise<ApiFriendshipPageDTO> {
    const ability = this.abilityFactory.createForUser(caller);
    assertLimitAllowed(query, ability);

    const where: Prisma.FriendshipWhereInput = {
      AND: [
        accessibleBy(ability, 'read').ofType('Friendship'),
        matching(query),
      ],
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.friendship.findMany({
        where,
        select: FRIENDSHIP_SELECT,
        orderBy: { id: 'desc' },
        skip: skipFor(query),
        take: query.limit,
      }),
      this.prisma.friendship.count({ where }),
    ]);
    assertPageWithin(query, total);

    return ApiFriendshipPageSchema.parse({
      data: rows.map((row) => this.presented(row)),
      ...pageMeta(query, total),
    });
  }

  async findOneFriendship(id: number, caller: User): Promise<ApiFriendshipDTO> {
    const ability = this.abilityFactory.createForUser(caller);

    return this.presented(await this.readable(id, ability));
  }

  async createFriendship(
    body: ApiFriendshipCreateDTO,
    caller: User,
  ): Promise<ApiFriendshipDTO> {
    const ability = this.abilityFactory.createForUser(caller);

    if (body.addresseeId === caller.id) {
      throw new BadRequestException('You cannot befriend yourself');
    }

    await this.assertMayApproach(body.addresseeId, ability);

    const stored = await this.settle(caller.id, body.addresseeId, ability);

    return this.presented(stored);
  }

  async updateFriendship(
    id: number,
    body: ApiFriendshipUpdateDTO,
    caller: User,
  ): Promise<ApiFriendshipDTO> {
    const ability = this.abilityFactory.createForUser(caller);
    const friendship = await this.readable(id, ability);

    this.assertMayAnswer(friendship, ability);

    /**
     * The write replays the `update` rule in the database instead of copying
     * its conditions: two concurrent PATCH requests would both read `pending`
     * and both pass assertMayAnswer, and the row can change `addresseeId`
     * in between (settle reopens a withdrawn friendship). Going through
     * `accessibleBy` therefore also holds the identity of the answering side,
     * not just the status. `count === 1` marks the write that actually won
     * the race.
     */
    const { count } = await this.prisma.friendship.updateMany({
      where: {
        AND: [accessibleBy(ability, 'update').ofType('Friendship'), { id }],
      },
      data: { status: body.status },
    });

    const answered = await this.readable(id, ability);

    if (count === 1) {
      const { requester } = parties(answered);
      await this.notifications.clearFriendRequest(caller.id, requester.id);
      if (body.status === FriendshipStatus.accepted) {
        await this.notifications.notifyFriendAccepted(requester.id, caller.id);
      }
    }

    return this.presented(answered);
  }

  async removeFriendship(id: number, caller: User): Promise<void> {
    const ability = this.abilityFactory.createForUser(caller);
    const friendship = await this.readable(id, ability);

    this.assertMayWithdraw(friendship, ability);

    await this.prisma.friendship.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    const other =
      friendship.userAId === caller.id
        ? friendship.userBId
        : friendship.userAId;
    await this.notifications.clearFriendNotifications(other, caller.id);
    await this.notifications.clearFriendNotifications(caller.id, other);
  }

  /**
   * A crossing request counts as an acceptance: if the other side had already
   * asked, no second row is created, theirs is answered instead. The pair is
   * stored in the canonical order shared with the backend, without which two
   * opposite requests would escape the uniqueness constraint.
   */
  private async settle(
    requesterId: number,
    addresseeId: number,
    ability: AppAbility,
  ): Promise<StoredFriendship> {
    const pair = canonicalPair(requesterId, addresseeId);
    // Deliberately outside the read scope: the policy hides deleted rows, yet
    // that is exactly the one to find again in order to reopen it. The pair
    // contains the caller, so nothing foreign is read.
    const existing = await this.prisma.friendship.findUnique({
      where: { userAId_userBId: pair },
      select: FRIENDSHIP_SELECT,
    });

    if (existing && existing.deletedAt === null) {
      if (existing.status === FriendshipStatus.accepted) {
        throw new ConflictException('You are already friends with this user');
      }

      if (existing.status === FriendshipStatus.pending) {
        return existing.addresseeId === requesterId
          ? this.acceptOnTheirBehalf(
              existing,
              requesterId,
              addresseeId,
              ability,
            )
          : existing;
      }
    }

    const stored = await this.prisma.friendship.upsert({
      where: { userAId_userBId: pair },
      create: { ...pair, addresseeId, status: FriendshipStatus.pending },
      update: {
        addresseeId,
        status: FriendshipStatus.pending,
        deletedAt: null,
        createdAt: new Date(),
      },
      select: FRIENDSHIP_SELECT,
    });

    await this.notifications.notifyFriendRequest(addresseeId, requesterId);

    return stored;
  }

  /**
   * The write replays the `update` rule in the database so a concurrent
   * acceptance cannot send the notification twice, and so the row stays one
   * the caller is allowed to answer: `settle` can rewrite its `addresseeId`
   * between the read and the write.
   */
  private async acceptOnTheirBehalf(
    existing: StoredFriendship,
    requesterId: number,
    addresseeId: number,
    ability: AppAbility,
  ): Promise<StoredFriendship> {
    const { count } = await this.prisma.friendship.updateMany({
      where: {
        AND: [
          accessibleBy(ability, 'update').ofType('Friendship'),
          { id: existing.id },
        ],
      },
      data: { status: FriendshipStatus.accepted },
    });

    if (count === 1) {
      await this.notifications.clearFriendRequest(requesterId, addresseeId);
      await this.notifications.notifyFriendAccepted(addresseeId, requesterId);
    }

    return this.readable(existing.id, ability);
  }

  private async readable(
    id: number,
    ability: AppAbility,
  ): Promise<StoredFriendship> {
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        AND: [accessibleBy(ability, 'read').ofType('Friendship'), { id }],
      },
      select: FRIENDSHIP_SELECT,
    });

    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    return friendship;
  }

  private async assertMayApproach(
    userId: number,
    ability: AppAbility,
  ): Promise<void> {
    const target = await this.prisma.user.findFirst({
      where: {
        AND: [
          accessibleBy(ability, 'interact').ofType('User'),
          { id: userId, deletedAt: null },
        ],
      },
      select: { id: true },
    });

    if (!target) {
      throw new ForbiddenException('Not allowed to befriend this user');
    }
  }

  private assertMayAnswer(
    friendship: StoredFriendship,
    ability: AppAbility,
  ): void {
    if (ability.cannot('update', subject('Friendship', friendship))) {
      throw new ForbiddenException('Not allowed to answer this request');
    }
  }

  private assertMayWithdraw(
    friendship: StoredFriendship,
    ability: AppAbility,
  ): void {
    if (ability.cannot('delete', subject('Friendship', friendship))) {
      throw new ForbiddenException('Not allowed to withdraw this friendship');
    }
  }

  private presented(row: StoredFriendship): ApiFriendshipDTO {
    return ApiFriendshipSchema.parse({ ...row, ...parties(row) });
  }
}
