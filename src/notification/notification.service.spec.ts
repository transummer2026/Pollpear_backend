import { Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WebsocketEmitter } from 'src/websocket/websocket.emitter';
import { NotificationService } from './notification.service';

function makeNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    type: 'friend_request',
    content: 'alice sent you a friend request.',
    isRead: false,
    createdAt: new Date('2026-08-22T12:00:00Z'),
    updatedAt: new Date('2026-08-22T12:00:00Z'),
    userId: 7,
    actorId: 3,
    ...overrides,
  };
}

describe('NotificationService', () => {
  const create = jest.fn();
  const findMany = jest.fn();
  const updateMany = jest.fn();
  const deleteMany = jest.fn();
  const prisma = {
    notification: { create, findMany, updateMany, deleteMany },
  } as unknown as PrismaService;
  const toUser = jest.fn<void, [number, string, Record<string, unknown>]>();
  const emitter = { toUser } as unknown as WebsocketEmitter;
  const service = new NotificationService(prisma, emitter);

  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  beforeEach(() => jest.clearAllMocks());

  describe('notify', () => {
    beforeEach(() => findMany.mockResolvedValue([]));

    it('persists the notification and pushes it over the socket', async () => {
      create.mockResolvedValue(makeNotification());

      await service.notify(
        7,
        'friend_request',
        'alice sent you a friend request.',
        3,
      );

      expect(create).toHaveBeenCalledWith({
        data: {
          userId: 7,
          type: 'friend_request',
          content: 'alice sent you a friend request.',
          actorId: 3,
        },
      });
      expect(toUser).toHaveBeenCalledWith(
        7,
        'notification:new',
        expect.objectContaining({ id: 1, type: 'friend_request' }),
      );
    });

    it('emits a dto without the internal userId field', async () => {
      create.mockResolvedValue(makeNotification());

      await service.notify(7, 'friend_request', 'hi');

      const [, , dto] = toUser.mock.calls[0];
      expect(dto).not.toHaveProperty('userId');
      expect(dto).not.toHaveProperty('updatedAt');
    });

    it('swallows a write failure and never emits', async () => {
      create.mockRejectedValue(new Error('db down'));

      await expect(
        service.notify(7, 'friend_accepted', 'x'),
      ).resolves.toBeUndefined();

      expect(toUser).not.toHaveBeenCalled();
    });
  });

  describe('getMine', () => {
    it('returns the caller notifications, unread first then newest', async () => {
      findMany.mockResolvedValue([makeNotification()]);

      const result = await service.getMine(7);

      expect(findMany).toHaveBeenCalledWith({
        where: { userId: 7 },
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
        take: 30,
      });
      expect(result[0]).not.toHaveProperty('userId');
    });
  });

  describe('pruning', () => {
    it('deletes notifications beyond the newest limit after creating one', async () => {
      create.mockResolvedValue(makeNotification());
      findMany.mockResolvedValue([{ id: 101 }, { id: 102 }]);

      await service.notify(7, 'friend_request', 'x');

      expect(findMany).toHaveBeenCalledWith({
        where: { userId: 7 },
        orderBy: { createdAt: 'desc' },
        skip: 30,
        select: { id: true },
      });
      expect(deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [101, 102] } },
      });
    });

    it('does not delete when the user is under the limit', async () => {
      create.mockResolvedValue(makeNotification());
      findMany.mockResolvedValue([]);

      await service.notify(7, 'friend_request', 'x');

      expect(deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('markAllRead', () => {
    it('flips only the caller unread notifications', async () => {
      updateMany.mockResolvedValue({ count: 3 });

      await service.markAllRead(7);

      expect(updateMany).toHaveBeenCalledWith({
        where: { userId: 7, isRead: false },
        data: { isRead: true },
      });
    });
  });

  describe('dismiss', () => {
    it('deletes one notification scoped to the caller', async () => {
      deleteMany.mockResolvedValue({ count: 1 });

      await service.dismiss(7, 42);

      expect(deleteMany).toHaveBeenCalledWith({ where: { id: 42, userId: 7 } });
    });
  });

  describe('clearFriendRequest', () => {
    it('removes the stale friend request notification of the addressee', async () => {
      deleteMany.mockResolvedValue({ count: 1 });

      await service.clearFriendRequest(7, 3);

      expect(deleteMany).toHaveBeenCalledWith({
        where: { userId: 7, type: 'friend_request', actorId: 3 },
      });
    });
  });
});
