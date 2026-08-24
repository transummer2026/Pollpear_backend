import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WebsocketEmitter } from 'src/websocket/websocket.emitter';
import {
  type NotificationDTO,
  NotificationSchema,
  type NotificationTypeDTO,
} from 'Pollpear_shared/src/schemas/notification.schema';

const NOTIFICATION_LIMIT = 30;

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private prisma: PrismaService,
    private emitter: WebsocketEmitter,
  ) {}

  async notify(
    userId: number,
    type: NotificationTypeDTO,
    content: string,
    actorId?: number,
  ): Promise<void> {
    try {
      const notification = await this.prisma.notification.create({
        data: { userId, type, content, actorId },
      });
      this.emitter.toUser(userId, 'notification:new', this.toDto(notification));
      await this.pruneOldest(userId);
    } catch (error) {
      this.logger.warn(
        `failed to create ${type} notification for user ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async getMine(userId: number): Promise<NotificationDTO[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: NOTIFICATION_LIMIT,
    });

    return notifications.map((notification) => this.toDto(notification));
  }

  async markAllRead(userId: number): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async dismiss(userId: number, id: number): Promise<void> {
    await this.prisma.notification.deleteMany({ where: { id, userId } });
  }

  async clearFriendRequest(
    addresseeId: number,
    requesterId: number,
  ): Promise<void> {
    try {
      const { count } = await this.prisma.notification.deleteMany({
        where: {
          userId: addresseeId,
          type: 'friend_request',
          actorId: requesterId,
        },
      });
      if (count > 0) {
        this.emitter.toUser(addresseeId, 'notification:removed', {
          type: 'friend_request',
          actorId: requesterId,
        });
      }
    } catch (error) {
      this.logger.warn(
        `failed to clear friend_request notification for user ${addresseeId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async pruneOldest(userId: number): Promise<void> {
    const stale = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: NOTIFICATION_LIMIT,
      select: { id: true },
    });
    if (stale.length === 0) return;
    await this.prisma.notification.deleteMany({
      where: { id: { in: stale.map((n) => n.id) } },
    });
  }

  private toDto(notification: unknown): NotificationDTO {
    return NotificationSchema.parse(notification);
  }
}
