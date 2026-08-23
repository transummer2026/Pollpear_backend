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
import { ForbiddenError, subject } from '@casl/ability';
import type { Friendship } from 'src/generated/prisma/client';

const FRIEND_USER_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
  isOnline: true,
} as const;

@Injectable()
export class FriendshipService {
  constructor(
    private prisma: PrismaService,
    private abilityFactory: CaslAbilityFactory,
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
        OR: [{ requesterId: targetId }, { addresseeId: targetId }],
        ...(callerId !== targetId
          ? { NOT: [{ requesterId: callerId }, { addresseeId: callerId }] }
          : {}),
      },
      include: {
        requester: { select: FRIEND_USER_SELECT },
        addressee: { select: FRIEND_USER_SELECT },
      },
    });

    return friendships.map((friendship) =>
      FriendListItemSchema.parse({
        friendshipId: friendship.id,
        status: friendship.status,
        createdAt: friendship.createdAt,
        user:
          friendship.requesterId === targetId
            ? friendship.addressee
            : friendship.requester,
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
      include: { requester: { select: FRIEND_USER_SELECT } },
    });

    return friendships.map((friendship) =>
      FriendListItemSchema.parse({
        friendshipId: friendship.id,
        status: friendship.status,
        createdAt: friendship.createdAt,
        user: friendship.requester,
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

    const existing = await this.findFriendshipBetween(userId, targetId);
    if (existing) {
      if (existing.status !== 'rejected') {
        throw new ConflictException(
          'A friendship already exists with this user.',
        );
      }

      const revived = await this.prisma.friendship.update({
        where: { id: existing.id },
        data: { requesterId: userId, addresseeId: targetId, status: 'pending' },
      });
      return FriendshipSchema.parse(revived);
    }

    const friendship = await this.prisma.friendship.upsert({
      where: {
        requesterId_addresseeId: {
          requesterId: userId,
          addresseeId: targetId,
        },
      },
      create: { requesterId: userId, addresseeId: targetId, status: 'pending' },
      update: { status: 'pending', deletedAt: null },
    });

    return FriendshipSchema.parse(friendship);
  }

  async updateFriendRequest(
    userId: number,
    otherId: number,
    status: FriendshipStatusUpdateDTO['status'],
  ): Promise<FriendshipDTO> {
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        requesterId: otherId,
        addresseeId: userId,
        status: 'pending',
        deletedAt: null,
      },
    });
    if (!friendship) {
      throw new NotFoundException('No pending friend request from this user.');
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
  }

  async friendIds(userId: number): Promise<number[]> {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        deletedAt: null,
        status: 'accepted',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: { requesterId: true, addresseeId: true },
    });

    return friendships.map((friendship) =>
      friendship.requesterId === userId
        ? friendship.addresseeId
        : friendship.requesterId,
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
      where: {
        deletedAt: null,
        OR: [
          { requesterId: userId, addresseeId: otherId },
          { requesterId: otherId, addresseeId: userId },
        ],
      },
    });
  }
}
