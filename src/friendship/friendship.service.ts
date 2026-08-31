import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  type FriendListItemDTO,
  FriendListItemSchema,
  type FriendshipDTO,
  FriendshipSchema,
  type FriendshipStatusUpdateDTO,
} from 'Pollpear_shared/src/schemas/friendship.schema';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { accessibleBy } from 'src/casl/casl-prisma';
import { NotificationService } from 'src/notification/notification.service';
import { ForbiddenError, subject } from '@casl/ability';
import { Prisma } from 'src/generated/prisma/client';
import type { Friendship, User } from 'src/generated/prisma/client';
import { canonicalPair } from './friendship.pair';

const FRIEND_USER_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
  isOnline: true,
} as const;

type FriendRequestOutcome = {
  friendship: Friendship;
  kind: 'created' | 'accepted' | 'unchanged';
};

@Injectable()
export class FriendshipService {
  constructor(
    private prisma: PrismaService,
    private abilityFactory: CaslAbilityFactory,
    private notificationService: NotificationService,
  ) {}

  async getFriendshipWith(
    viewer: User,
    otherId: number,
  ): Promise<FriendshipDTO | null> {
    const ability = this.abilityFactory.createForUser(viewer);
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        AND: [
          accessibleBy(ability, 'read').ofType('Friendship'),
          { ...canonicalPair(viewer.id, otherId), deletedAt: null },
        ],
      },
    });
    if (!friendship) return null;

    return FriendshipSchema.parse(friendship);
  }

  async getFriends(
    viewer: User,
    targetId: number,
  ): Promise<FriendListItemDTO[]> {
    const ability = this.abilityFactory.createForUser(viewer);
    const friendships = await this.prisma.friendship.findMany({
      where: {
        AND: [
          accessibleBy(ability, 'read').ofType('Friendship'),
          {
            deletedAt: null,
            status: 'accepted',
            OR: [{ userAId: targetId }, { userBId: targetId }],
            ...(viewer.id !== targetId
              ? { NOT: [{ userAId: viewer.id }, { userBId: viewer.id }] }
              : {}),
          },
        ],
      },
      include: {
        userA: { select: FRIEND_USER_SELECT },
        userB: { select: FRIEND_USER_SELECT },
      },
    });

    return friendships.map((friendship) =>
      FriendListItemSchema.parse({
        friendshipId: friendship.id,
        status: friendship.status,
        createdAt: friendship.createdAt,
        user:
          friendship.userAId === targetId ? friendship.userB : friendship.userA,
      }),
    );
  }

  async getFriendRequests(
    viewer: User,
    targetId: number,
  ): Promise<FriendListItemDTO[]> {
    const ability = this.abilityFactory.createForUser(viewer);
    ForbiddenError.from(ability).throwUnlessCan(
      'read',
      subject('Friendship', {
        addresseeId: targetId,
        status: 'pending',
      } as Friendship),
    );

    const friendships = await this.prisma.friendship.findMany({
      where: { addresseeId: targetId, status: 'pending', deletedAt: null },
      include: {
        userA: { select: FRIEND_USER_SELECT },
        userB: { select: FRIEND_USER_SELECT },
      },
    });

    return friendships.map((friendship) =>
      FriendListItemSchema.parse({
        friendshipId: friendship.id,
        status: friendship.status,
        createdAt: friendship.createdAt,
        user:
          friendship.addresseeId === friendship.userAId
            ? friendship.userB
            : friendship.userA,
      }),
    );
  }

  async createFriendRequest(
    viewer: User,
    targetId: number,
  ): Promise<FriendshipDTO> {
    const userId = viewer.id;
    if (userId === targetId) {
      throw new BadRequestException(
        'Cannot send a friend request to yourself.',
      );
    }

    const ability = this.abilityFactory.createForUser(viewer);
    const target = await this.prisma.user.findFirst({
      where: {
        AND: [
          accessibleBy(ability, 'interact').ofType('User'),
          { id: targetId, deletedAt: null },
        ],
      },
    });
    if (!target) {
      throw new ForbiddenException(
        'Cannot send a friend request to this user.',
      );
    }

    let outcome: FriendRequestOutcome;
    try {
      outcome = await this.resolveFriendRequest(userId, targetId);
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      outcome = await this.resolveFriendRequest(userId, targetId);
    }

    if (outcome.kind === 'accepted') {
      await this.notificationService.clearFriendRequest(userId, targetId);
      await this.notificationService.notifyFriendAccepted(targetId, userId);
      return FriendshipSchema.parse(outcome.friendship);
    }

    if (outcome.kind === 'unchanged') {
      return FriendshipSchema.parse(outcome.friendship);
    }

    const fresh = await this.prisma.friendship.findUnique({
      where: { id: outcome.friendship.id },
    });
    if (!fresh || fresh.deletedAt !== null) {
      return FriendshipSchema.parse(outcome.friendship);
    }
    if (fresh.status === 'accepted') {
      await this.notificationService.clearFriendRequest(targetId, userId);
    } else if (fresh.status === 'pending') {
      await this.notificationService.notifyFriendRequest(targetId, userId);
    }

    return FriendshipSchema.parse(fresh);
  }

  async updateFriendRequest(
    viewer: User,
    otherId: number,
    status: FriendshipStatusUpdateDTO['status'],
  ): Promise<FriendshipDTO> {
    const friendship = await this.findFriendshipBetween(viewer.id, otherId);
    if (!friendship) {
      throw new NotFoundException('No pending friend request from this user.');
    }

    // The addressee re-submitting the response they already gave is an
    // idempotent no-op (client double-tap) — for `rejected` as well as
    // `accepted` (`status` is never `pending`). Without the `rejected`
    // case a second tap falls through to the CASL `update` check, which
    // needs `status: 'pending'`, and 403s. `clearFriendRequest` repeats
    // safely.
    if (friendship.status === status && friendship.addresseeId === viewer.id) {
      await this.notificationService.clearFriendRequest(viewer.id, otherId);
      return FriendshipSchema.parse(friendship);
    }

    const ability = this.abilityFactory.createForUser(viewer);
    ForbiddenError.from(ability).throwUnlessCan(
      'update',
      subject('Friendship', friendship),
    );

    // Conditional write driven by the CASL "update" rule (deletedAt: null,
    // status: 'pending', addresseeId: viewer). Only the request that
    // actually flips the row (count === 1) fires the notifications below; a
    // concurrent double-tap loses the race (count === 0) and just gets the
    // current state back.
    const { count } = await this.prisma.friendship.updateMany({
      where: {
        AND: [
          accessibleBy(ability, 'update').ofType('Friendship'),
          { id: friendship.id },
        ],
      },
      data: { status },
    });

    const updated = await this.prisma.friendship.findUnique({
      where: { id: friendship.id },
    });
    if (!updated) {
      throw new NotFoundException('No pending friend request from this user.');
    }

    if (count === 0) {
      return FriendshipSchema.parse(updated);
    }

    await this.notificationService.clearFriendRequest(viewer.id, otherId);
    if (status === 'accepted') {
      await this.notificationService.notifyFriendAccepted(otherId, viewer.id);
    }

    return FriendshipSchema.parse(updated);
  }

  async removeFriendship(viewer: User, otherId: number): Promise<void> {
    const ability = this.abilityFactory.createForUser(viewer);
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        AND: [
          accessibleBy(ability, 'delete').ofType('Friendship'),
          { ...canonicalPair(viewer.id, otherId), deletedAt: null },
        ],
      },
    });
    if (!friendship) {
      throw new NotFoundException('No friendship found with this user.');
    }

    await this.prisma.friendship.update({
      where: { id: friendship.id },
      data: { deletedAt: new Date() },
    });

    const requesterId =
      friendship.addresseeId === friendship.userAId
        ? friendship.userBId
        : friendship.userAId;
    // Clear both directions: the pending "friend request" shown to the
    // addressee *and* any "accepted your friend request" already delivered
    // to the requester, so nothing lingers pointing at a deleted row.
    await this.notificationService.clearFriendNotifications(
      friendship.addresseeId,
      requesterId,
    );
    await this.notificationService.clearFriendNotifications(
      requesterId,
      friendship.addresseeId,
    );
  }

  async friendIds(userId: number): Promise<number[]> {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        deletedAt: null,
        status: 'accepted',
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      select: { userAId: true, userBId: true },
    });

    return friendships.map((friendship) =>
      friendship.userAId === userId ? friendship.userBId : friendship.userAId,
    );
  }

  private async resolveFriendRequest(
    userId: number,
    targetId: number,
  ): Promise<FriendRequestOutcome> {
    const pair = canonicalPair(userId, targetId);
    const existing = await this.prisma.friendship.findUnique({
      where: { userAId_userBId: pair },
    });

    if (existing && existing.deletedAt === null) {
      if (existing.status === 'accepted') {
        throw new ConflictException(
          'A friendship already exists with this user.',
        );
      }

      if (existing.status === 'pending' && existing.addresseeId === userId) {
        // Guard on status: 'pending' so a concurrent accept can't make both
        // callers report "accepted" and fire the notification twice.
        const { count } = await this.prisma.friendship.updateMany({
          where: { id: existing.id, status: 'pending', deletedAt: null },
          data: { status: 'accepted' },
        });
        const accepted = await this.prisma.friendship.findUnique({
          where: { id: existing.id },
        });
        return {
          friendship: accepted ?? existing,
          kind: count === 1 ? 'accepted' : 'unchanged',
        };
      }

      if (existing.status === 'pending') {
        return { friendship: existing, kind: 'unchanged' };
      }
    }

    const friendship = await this.prisma.friendship.upsert({
      where: { userAId_userBId: pair },
      create: { ...pair, addresseeId: targetId, status: 'pending' },
      update: {
        status: 'pending',
        addresseeId: targetId,
        deletedAt: null,
        createdAt: new Date(),
      },
    });

    return { friendship, kind: 'created' };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private findFriendshipBetween(userId: number, otherId: number) {
    return this.prisma.friendship.findFirst({
      where: { ...canonicalPair(userId, otherId), deletedAt: null },
    });
  }
}
