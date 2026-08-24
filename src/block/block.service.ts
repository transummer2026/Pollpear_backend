import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  type BlockDTO,
  BlockSchema,
  type BlockListItemDTO,
  BlockListItemSchema,
  type BlockStatusDTO,
  BlockStatusSchema,
} from 'Pollpear_shared/src/schemas/block.schema';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { NotificationService } from 'src/notification/notification.service';
import { canonicalPair } from 'src/friendship/friendship.pair';
import { ForbiddenError, subject } from '@casl/ability';
import type { Block } from 'src/generated/prisma/client';

const BLOCKED_USER_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
} as const;

@Injectable()
export class BlockService {
  constructor(
    private prisma: PrismaService,
    private abilityFactory: CaslAbilityFactory,
    private notificationService: NotificationService,
  ) {}

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
        where: { deletedAt: null, ...canonicalPair(userId, targetId) },
        data: { deletedAt: new Date() },
      }),
    ]);

    await this.notificationService.clearFriendRequest(targetId, userId);
    await this.notificationService.clearFriendRequest(userId, targetId);

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

  private async abilityFor(userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, role: true },
    });
    return this.abilityFactory.createForUser(user);
  }
}
