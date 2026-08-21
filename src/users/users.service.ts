import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { randomUUID } from 'crypto';
import {
  type UserDTO,
  UserSchema,
  type UserPublicProfileDTO,
  UserPublicProfileSchema,
  type UserUpdateDTO,
} from 'Pollpear_shared/src/schemas/users.schema';
import {
  type FriendListItemDTO,
  FriendListItemSchema,
  type FriendshipDTO,
  FriendshipSchema,
  type FriendshipStatusUpdateDTO,
} from 'Pollpear_shared/src/schemas/friendship.schema';
import {
  type BlockDTO,
  BlockSchema,
  type BlockListItemDTO,
  BlockListItemSchema,
  type BlockStatusDTO,
  BlockStatusSchema,
} from 'Pollpear_shared/src/schemas/block.schema';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { ForbiddenError, subject } from '@casl/ability';
import type { Block, Friendship } from 'src/generated/prisma/client';

const SEARCH_RESULTS_LIMIT = 5;
const SEARCH_SELECT = {
  id: true,
  username: true,
  name: true,
  surname: true,
  avatarUrl: true,
} as const;

const FRIEND_USER_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
  isOnline: true,
} as const;

const BLOCKED_USER_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private abilityFactory: CaslAbilityFactory,
  ) {}

  /**
   * Prefix matches on username rank first (the "find that exact friend"
   * case), then contains matches on username/name/surname fill the rest:
   * Prisma has no relevance-ordered ORDER BY without raw SQL.
   */
  async search(q: string) {
    const startsWith = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        visibility: { not: 'private' },
        username: { startsWith: q, mode: 'insensitive' },
      },
      select: SEARCH_SELECT,
      orderBy: { username: 'asc' },
      take: SEARCH_RESULTS_LIMIT,
    });

    const remaining = SEARCH_RESULTS_LIMIT - startsWith.length;
    if (remaining <= 0) return startsWith;

    const contains = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        visibility: { not: 'private' },
        id: { notIn: startsWith.map((user) => user.id) },
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { surname: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: SEARCH_SELECT,
      orderBy: { username: 'asc' },
      take: remaining,
    });

    return [...startsWith, ...contains];
  }

  async findOne(id: number): Promise<UserPublicProfileDTO> {
    const user = await this.findByUserId(id);
    if (!user) throw new NotFoundException('User not found');
    return UserPublicProfileSchema.parse(user);
  }

  report(id: number) {
    return `report user #${id} works`;
  }

  async getBlockStatus(
    callerId: number,
    targetId: number,
  ): Promise<BlockStatusDTO> {
    const [blockedByMe, blockedMe] = await Promise.all([
      this.prisma.block.findUnique({
        where: {
          blockerId_blockedId: { blockerId: callerId, blockedId: targetId },
        },
      }),
      this.prisma.block.findUnique({
        where: {
          blockerId_blockedId: { blockerId: targetId, blockedId: callerId },
        },
      }),
    ]);

    return BlockStatusSchema.parse({
      blockedByMe: blockedByMe !== null,
      blockedMe: blockedMe !== null,
    });
  }

  async getBlockedUsers(
    callerId: number,
    targetId: number,
  ): Promise<BlockListItemDTO[]> {
    const ability = await this.abilityFor(callerId);
    ForbiddenError.from(ability).throwUnlessCan(
      'read',
      subject('Block', { blockerId: targetId } as Block),
    );

    const blocks = await this.prisma.block.findMany({
      where: { blockerId: targetId },
      include: { blocked: { select: BLOCKED_USER_SELECT } },
    });

    return blocks.map((block) =>
      BlockListItemSchema.parse({
        blockId: block.id,
        createdAt: block.createdAt,
        user: block.blocked,
      }),
    );
  }

  async blockUser(userId: number, targetId: number): Promise<BlockDTO> {
    if (userId === targetId) {
      throw new BadRequestException('Cannot block yourself.');
    }

    const existing = await this.prisma.block.findUnique({
      where: {
        blockerId_blockedId: { blockerId: userId, blockedId: targetId },
      },
    });
    if (existing) {
      throw new ConflictException('You already blocked this user.');
    }

    const [block] = await this.prisma.$transaction([
      this.prisma.block.create({
        data: { blockerId: userId, blockedId: targetId },
      }),
      this.prisma.friendship.updateMany({
        where: {
          deletedAt: null,
          OR: [
            { requesterId: userId, addresseeId: targetId },
            { requesterId: targetId, addresseeId: userId },
          ],
        },
        data: { deletedAt: new Date() },
      }),
    ]);

    return BlockSchema.parse(block);
  }

  async unblockUser(userId: number, targetId: number): Promise<void> {
    const existing = await this.prisma.block.findUnique({
      where: {
        blockerId_blockedId: { blockerId: userId, blockedId: targetId },
      },
    });
    if (!existing) {
      throw new NotFoundException('You have not blocked this user.');
    }

    const ability = await this.abilityFor(userId);
    ForbiddenError.from(ability).throwUnlessCan(
      'delete',
      subject('Block', existing),
    );

    await this.prisma.block.delete({ where: { id: existing.id } });
  }

  async getFriendshipWith(
    userId: number,
    otherId: number,
  ): Promise<FriendshipDTO | null> {
    const friendship = await this.findFriendshipBetween(userId, otherId);
    return friendship ? FriendshipSchema.parse(friendship) : null;
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

  private async abilityFor(userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
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

  ban(id: number) {
    return `ban user #${id} works`;
  }

  updateBan(id: number) {
    return `updated ban for user #${id} works`;
  }

  async update(
    id: number,
    userId: number,
    body: UserUpdateDTO,
  ): Promise<UserDTO> {
    const requester = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const target = await this.prisma.user.findUniqueOrThrow({ where: { id } });

    const ability = this.abilityFactory.createForUser(requester);
    ForbiddenError.from(ability).throwUnlessCan(
      'update',
      subject('User', target),
    );

    const updatedUser = await this.updateUserProfile(id, body);
    return UserSchema.parse(updatedUser);
  }

  remove(id: number) {
    return `remove user #${id} works`;
  }

  // PRISMA REQUESTS

  async findByUserId(userId: number) {
    if (isNaN(userId)) throw new ForbiddenException('Invalid user id.');
    return await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
  }

  async findByEmail(email: string) {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByBanStatus(userId: number) {
    return await this.prisma.ban.findFirst({
      where: {
        userId,
        endedAt: {
          gt: new Date(),
        },
      },
    });
  }

  generateSessionId() {
    return randomUUID();
  }

  async updatePassword(userId: number, passwordHash: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async verifyEmail(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: true },
    });
  }

  async setOnline(userId: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isOnline: true },
    });
  }

  async setOffline(userId: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isOnline: false, lastSeenAt: new Date() },
    });
  }

  async resetOnlineStatus(): Promise<number> {
    const { count } = await this.prisma.user.updateMany({
      where: { isOnline: true },
      data: { isOnline: false },
    });
    return count;
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

  private async updateUserProfile(userId: number, data: UserUpdateDTO) {
    return await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: data,
    });
  }
}
