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

  async notifyFriendRequest(
    recipientId: number,
    actorId: number,
  ): Promise<void> {
    await this.notifyFriendEvent(
      recipientId,
      actorId,
      'friend_request',
      (username) => `${username} sent you a friend request.`,
    );
  }

  async notifyFriendAccepted(
    recipientId: number,
    actorId: number,
  ): Promise<void> {
    await this.notifyFriendEvent(
      recipientId,
      actorId,
      'friend_accepted',
      (username) => `${username} accepted your friend request.`,
    );
  }

  async clearFriendRequest(
    addresseeId: number,
    requesterId: number,
  ): Promise<void> {
    await this.clearFriendNotification(
      addresseeId,
      requesterId,
      'friend_request',
    );
  }

  async clearFriendNotifications(
    recipientId: number,
    actorId: number,
  ): Promise<void> {
    await this.clearFriendNotification(recipientId, actorId, 'friend_request');
    await this.clearFriendNotification(recipientId, actorId, 'friend_accepted');
  }

  private async notifyFriendEvent(
    recipientId: number,
    actorId: number,
    type: 'friend_request' | 'friend_accepted',
    message: (username: string) => string,
  ): Promise<void> {
    try {
      const actor = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { username: true },
      });
      if (!actor) return;
      await this.notify(recipientId, type, message(actor.username), actorId);
    } catch (error) {
      this.logger.warn(
        `failed to build ${type} notification for user ${recipientId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async clearFriendNotification(
    recipientId: number,
    actorId: number,
    type: 'friend_request' | 'friend_accepted',
  ): Promise<void> {
    try {
      const { count } = await this.prisma.notification.deleteMany({
        where: { userId: recipientId, type, actorId },
      });
      if (count > 0) {
        this.emitter.toUser(recipientId, 'notification:removed', {
          type,
          actorId,
        });
      }
    } catch (error) {
      this.logger.warn(
        `failed to clear ${type} notification for user ${recipientId}: ${
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
