import { ForbiddenError } from '@casl/ability';
import { NotFoundException } from '@nestjs/common';
import { MessageReadSchema } from 'Pollpear_shared/src/schemas/messages.schema';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { accessibleBy } from 'src/casl/casl-prisma';
import { PrismaService } from 'src/prisma/prisma.service';
import type { User } from 'src/generated/prisma/client';
import { MessagesService } from './messages.service';

const VIEWER_ID = 42;
const viewer = { id: VIEWER_ID, role: 'user' } as User;

function room(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    status: 'active',
    deletedAt: null,
    roomMembers: [{ userId: VIEWER_ID, deletedAt: null }],
    ...overrides,
  };
}

function message(id: number) {
  return { id, roomId: 7, authorId: VIEWER_ID, content: `m${id}` };
}

describe('MessagesService', () => {
  const messageFindMany = jest.fn();
  const messageCreate = jest.fn();
  const roomFindFirst = jest.fn();
  const roomCount = jest.fn();
  const prisma = {
    message: { findMany: messageFindMany, create: messageCreate },
    room: { findFirst: roomFindFirst, count: roomCount },
  } as unknown as PrismaService;
  const abilityFactory = new CaslAbilityFactory();
  const service = new MessagesService(prisma, abilityFactory);

  const readAccessibleWhere = accessibleBy(
    abilityFactory.createForUser(viewer),
    'read',
  ).ofType('Message');

  jest
    .spyOn(MessageReadSchema, 'parse')
    .mockImplementation(
      (value) => value as ReturnType<typeof MessageReadSchema.parse>,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    roomFindFirst.mockResolvedValue(room());
    roomCount.mockResolvedValue(1);
  });

  describe('listForRoom', () => {
    it('reports a room the viewer cannot read as not found', async () => {
      roomCount.mockResolvedValue(0);

      await expect(
        service.listForRoom(7, viewer, { limit: 50 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(messageFindMany).not.toHaveBeenCalled();
    });

    it('walks back with `before` and returns the page oldest first', async () => {
      messageFindMany.mockResolvedValue([message(3), message(2), message(1)]);

      const result = await service.listForRoom(7, viewer, {
        before: 4,
        limit: 50,
      });

      expect(messageFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              readAccessibleWhere,
              { roomId: 7, deletedAt: null },
              { id: { lt: 4 } },
            ],
          },
          orderBy: { id: 'desc' },
          take: 50,
        }),
      );
      expect(result.map((m) => m.id)).toEqual([1, 2, 3]);
    });

    it('catches up with `after` in ascending order, without reversing', async () => {
      messageFindMany.mockResolvedValue([message(5), message(6)]);

      const result = await service.listForRoom(7, viewer, {
        after: 4,
        limit: 200,
      });

      expect(messageFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              readAccessibleWhere,
              { roomId: 7, deletedAt: null },
              { id: { gt: 4 } },
            ],
          },
          orderBy: { id: 'asc' },
          take: 200,
        }),
      );
      expect(result.map((m) => m.id)).toEqual([5, 6]);
    });

    it('asks for the newest page when no cursor is given', async () => {
      messageFindMany.mockResolvedValue([]);

      await service.listForRoom(7, viewer, { limit: 50 });

      expect(messageFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [readAccessibleWhere, { roomId: 7, deletedAt: null }] },
          orderBy: { id: 'desc' },
        }),
      );
    });
  });

  describe('create', () => {
    it('persists the message as its author and returns it', async () => {
      roomFindFirst.mockResolvedValue(room());
      messageCreate.mockResolvedValue(message(1));

      const result = await service.create(viewer, { roomId: 7, content: 'hi' });

      expect(messageCreate).toHaveBeenCalledWith({
        data: { roomId: 7, authorId: VIEWER_ID, content: 'hi' },
        include: { author: true },
      });
      expect(result).toEqual(message(1));
    });

    it('refuses a user who is not a member of the room', async () => {
      roomFindFirst.mockResolvedValue(room({ roomMembers: [] }));

      await expect(
        service.create(viewer, { roomId: 7, content: 'hi' }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(messageCreate).not.toHaveBeenCalled();
    });

    it('refuses a closed room even to a member', async () => {
      roomFindFirst.mockResolvedValue(room({ status: 'closed' }));

      await expect(
        service.create(viewer, { roomId: 7, content: 'hi' }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(messageCreate).not.toHaveBeenCalled();
    });

    it('reports a missing room as not found', async () => {
      roomFindFirst.mockResolvedValue(null);

      await expect(
        service.create(viewer, { roomId: 7, content: 'hi' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('assertCanJoin', () => {
    it('lets a member join the room channel', async () => {
      roomFindFirst.mockResolvedValue(room());

      await expect(service.assertCanJoin(viewer, 7)).resolves.toBeUndefined();
    });

    it('refuses a non-member, closed room or not', async () => {
      roomFindFirst.mockResolvedValue(room({ roomMembers: [] }));

      await expect(service.assertCanJoin(viewer, 7)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });

    it('lets a member read a closed room', async () => {
      roomFindFirst.mockResolvedValue(room({ status: 'closed' }));

      await expect(service.assertCanJoin(viewer, 7)).resolves.toBeUndefined();
    });
  });
});
