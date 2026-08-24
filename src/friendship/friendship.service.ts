import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
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
  private readonly logger = new Logger(FriendshipService.name);

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

    let outcome: FriendRequestOutcome;
    try {
      outcome = await this.resolveFriendRequest(userId, targetId);
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      outcome = await this.resolveFriendRequest(userId, targetId);
    }

    if (outcome.kind === 'accepted') {
      await this.notificationService.clearFriendRequest(userId, targetId);
      await this.notifyFriendAccepted(userId, targetId);
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
      await this.notifyFriendRequest(userId, targetId);
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

    if (status === 'accepted' && friendship.status === 'accepted') {
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
      await this.notifyFriendAccepted(userId, otherId);
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
      friendship.requesterId,
    );
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

  private async resolveFriendRequest(
    userId: number,
    targetId: number,
  ): Promise<FriendRequestOutcome> {
    const relations = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: userId, addresseeId: targetId },
          { requesterId: targetId, addresseeId: userId },
        ],
      },
    });

    const activeRelations = relations.filter(
      (relation) => relation.deletedAt === null,
    );
    const active =
      activeRelations.find((relation) => relation.status === 'accepted') ??
      activeRelations.find((relation) => relation.status === 'pending') ??
      activeRelations[0];

    if (active?.status === 'accepted') {
      throw new ConflictException(
        'A friendship already exists with this user.',
      );
    }

    if (active?.status === 'pending' && active.addresseeId === userId) {
      const accepted = await this.prisma.friendship.update({
        where: { id: active.id },
        data: { status: 'accepted' },
      });
      return { friendship: accepted, kind: 'accepted' };
    }

    if (active?.status === 'pending') {
      return { friendship: active, kind: 'unchanged' };
    }

    const sameDirection = relations.find(
      (relation) =>
        relation.requesterId === userId && relation.addresseeId === targetId,
    );
    const reverseActive = activeRelations.find(
      (relation) => relation.requesterId === targetId,
    );
    if (reverseActive) {
      await this.prisma.friendship.update({
        where: { id: reverseActive.id },
        data: { deletedAt: new Date() },
      });
    }

    const friendship = sameDirection
      ? await this.prisma.friendship.update({
          where: { id: sameDirection.id },
          data: { status: 'pending', deletedAt: null, createdAt: new Date() },
        })
      : await this.prisma.friendship.create({
          data: {
            requesterId: userId,
            addresseeId: targetId,
            status: 'pending',
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

  private async notifyFriendRequest(fromId: number, toId: number) {
    await this.sendFriendNotification(
      fromId,
      toId,
      'friend_request',
      (name) => `${name} sent you a friend request.`,
    );
  }

  private async notifyFriendAccepted(fromId: number, toId: number) {
    await this.sendFriendNotification(
      fromId,
      toId,
      'friend_accepted',
      (name) => `${name} accepted your friend request.`,
    );
  }

  private async sendFriendNotification(
    fromId: number,
    toId: number,
    type: 'friend_request' | 'friend_accepted',
    message: (username: string) => string,
  ) {
    try {
      const sender = await this.prisma.user.findUnique({
        where: { id: fromId },
        select: { username: true },
      });
      if (!sender) return;
      await this.notificationService.notify(
        toId,
        type,
        message(sender.username),
        fromId,
      );
    } catch (error) {
      this.logger.warn(
        `failed to send ${type} notification to user ${toId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
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
