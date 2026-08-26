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
import { NotificationService } from 'src/notification/notification.service';
import { ForbiddenError, subject } from '@casl/ability';
import { Prisma } from 'src/generated/prisma/client';
import type { Friendship } from 'src/generated/prisma/client';
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
    userId: number,
    otherId: number,
  ): Promise<FriendshipDTO | null> {
    const friendship = await this.findFriendshipBetween(userId, otherId);
    if (!friendship) return null;

    const ability = await this.abilityFor(userId);
    ForbiddenError.from(ability).throwUnlessCan(
      'read',
      subject('Friendship', friendship),
    );

    return FriendshipSchema.parse(friendship);
  }

  async getFriends(
    callerId: number,
    targetId: number,
  ): Promise<FriendListItemDTO[]> {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        deletedAt: null,
        status: 'accepted',
        OR: [{ userAId: targetId }, { userBId: targetId }],
        ...(callerId !== targetId
          ? { NOT: [{ userAId: callerId }, { userBId: callerId }] }
          : {}),
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
    callerId: number,
    targetId: number,
  ): Promise<FriendListItemDTO[]> {
    const ability = await this.abilityFor(callerId);
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
    userId: number,
    targetId: number,
  ): Promise<FriendshipDTO> {
    if (userId === targetId) {
      throw new BadRequestException(
        'Cannot send a friend request to yourself.',
      );
    }

    const blocked = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: targetId },
          { blockerId: targetId, blockedId: userId },
        ],
      },
    });
    if (blocked) {
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
    userId: number,
    otherId: number,
    status: FriendshipStatusUpdateDTO['status'],
  ): Promise<FriendshipDTO> {
    const friendship = await this.findFriendshipBetween(userId, otherId);
    if (!friendship) {
      throw new NotFoundException('No pending friend request from this user.');
    }

    if (
      status === 'accepted' &&
      friendship.status === 'accepted' &&
      friendship.addresseeId === userId
    ) {
      await this.notificationService.clearFriendRequest(userId, otherId);
      return FriendshipSchema.parse(friendship);
    }

    const ability = await this.abilityFor(userId);
    ForbiddenError.from(ability).throwUnlessCan(
      'update',
      subject('Friendship', friendship),
    );

    const updated = await this.prisma.friendship.update({
      where: { id: friendship.id },
      data: { status },
    });

    await this.notificationService.clearFriendRequest(userId, otherId);
    if (status === 'accepted') {
      await this.notificationService.notifyFriendAccepted(otherId, userId);
    }

    return FriendshipSchema.parse(updated);
  }

  async removeFriendship(userId: number, otherId: number): Promise<void> {
    const friendship = await this.findFriendshipBetween(userId, otherId);
    if (!friendship) {
      throw new NotFoundException('No friendship found with this user.');
    }

    const ability = await this.abilityFor(userId);
    ForbiddenError.from(ability).throwUnlessCan(
      'delete',
      subject('Friendship', friendship),
    );

    await this.prisma.friendship.update({
      where: { id: friendship.id },
      data: { deletedAt: new Date() },
    });

    await this.notificationService.clearFriendRequest(
      friendship.addresseeId,
      friendship.addresseeId === friendship.userAId
        ? friendship.userBId
        : friendship.userAId,
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
        const accepted = await this.prisma.friendship.update({
          where: { id: existing.id },
          data: { status: 'accepted' },
        });
        return { friendship: accepted, kind: 'accepted' };
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

  private async abilityFor(userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, role: true },
    });
    return this.abilityFactory.createForUser(user);
  }

  private findFriendshipBetween(userId: number, otherId: number) {
    return this.prisma.friendship.findFirst({
      where: { ...canonicalPair(userId, otherId), deletedAt: null },
    });
  }
}
