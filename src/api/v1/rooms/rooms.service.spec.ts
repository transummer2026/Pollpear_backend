import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiRoomsService } from './rooms.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { accessibleBy } from 'src/casl/casl-prisma';
import type { User } from 'src/generated/prisma/client';

const owner = { id: 7, role: 'user' } as unknown as User;
const stranger = { id: 8, role: 'user' } as unknown as User;
const moderator = { id: 2, role: 'moderator' } as unknown as User;
const admin = { id: 1, role: 'admin' } as unknown as User;

const listedRoom = {
  id: 42,
  name: 'Fruit lovers',
  bannerUrl: '/uploads/banners/default.svg',
  visibility: 'public',
  status: 'active',
  endsAt: null,
  _count: { roomMembers: 3 },
};

const activeRoom = {
  id: 42,
  name: 'Fruit lovers',
  description: null,
  bannerUrl: '/uploads/banners/default.svg',
  visibility: 'public',
  status: 'active',
  endsAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  deletedAt: null,
  createdById: 7,
  createdBy: { id: 7, username: 'pollpear' },
  _count: { roomMembers: 3, polls: 2 },
};

const closedRoom = { ...activeRoom, status: 'closed' };
const expiredRoom = { ...activeRoom, endsAt: new Date('2020-01-01') };
const goneRoom = { ...activeRoom, deletedAt: new Date('2026-02-01') };

const page = { page: 1, limit: 20 };

type Queried = { where: Record<string, unknown>; skip?: number; take?: number };

describe('ApiRoomsService', () => {
  let service: ApiRoomsService;
  const findMany = jest.fn<Promise<unknown>, [Queried]>();
  const count = jest.fn();
  const findFirst = jest.fn<Promise<unknown>, [Queried]>();
  const create = jest.fn<
    Promise<unknown>,
    [{ data: Record<string, unknown> }]
  >();
  const update = jest.fn<
    Promise<unknown>,
    [{ data: Record<string, unknown> }]
  >();
  const updateMany = jest.fn<
    Promise<{ count: number }>,
    [{ where: object; data: object }]
  >();
  const transaction = jest.fn<Promise<unknown[]>, [unknown[]]>();

  beforeEach(async () => {
    [
      findMany,
      count,
      findFirst,
      create,
      update,
      updateMany,
      transaction,
    ].forEach((fn) => fn.mockReset());
    updateMany.mockResolvedValue({ count: 0 });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiRoomsService,
        CaslAbilityFactory,
        {
          provide: PrismaService,
          useValue: {
            room: { findMany, count, findFirst, create, update, updateMany },
            $transaction: transaction,
          },
        },
      ],
    }).compile();

    service = module.get<ApiRoomsService>(ApiRoomsService);
  });

  describe('findAllRooms', () => {
    it('wraps the rows in the shared page envelope', async () => {
      transaction.mockResolvedValue([[listedRoom], 1]);

      expect(await service.findAllRooms(page, owner)).toEqual({
        data: [
          {
            id: 42,
            name: 'Fruit lovers',
            bannerUrl: '/uploads/banners/default.svg',
            visibility: 'public',
            status: 'active',
            endsAt: null,
            memberCount: 3,
          },
        ],
        page: 1,
        limit: 20,
        total: 1,
      });
    });

    it('scopes the list with the Room policy, never a hand-written filter', async () => {
      transaction.mockResolvedValue([[], 0]);

      await service.findAllRooms(page, owner);

      const { where } = findMany.mock.calls[0][0];
      expect(where).toEqual({
        AND: [
          accessibleBy(
            new CaslAbilityFactory().createForUser(owner),
            'read',
          ).ofType('Room'),
          {},
        ],
      });
    });

    it('counts the live members only', async () => {
      transaction.mockResolvedValue([[], 0]);

      await service.findAllRooms(page, owner);

      const { select } = findMany.mock.calls[0][0] as unknown as {
        select: { _count: { select: { roomMembers: unknown } } };
      };
      expect(select._count.select.roomMembers).toEqual({
        where: { deletedAt: null },
      });
    });

    it('narrows on the filters the query carries', async () => {
      transaction.mockResolvedValue([[], 0]);

      await service.findAllRooms(
        { ...page, status: 'active', createdBy: 7 },
        owner,
      );

      const { where } = findMany.mock.calls[0][0] as unknown as {
        where: { AND: [unknown, Record<string, unknown>] };
      };
      expect(where.AND[1]).toEqual({ status: 'active', createdById: 7 });
    });

    it('refuses a page larger than the caller role allows', async () => {
      await expect(
        service.findAllRooms({ page: 1, limit: 51 }, owner),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(transaction).not.toHaveBeenCalled();
    });

    it('refuses a page past the last one instead of answering it empty', async () => {
      transaction.mockResolvedValue([[], 5]);

      await expect(
        service.findAllRooms({ page: 2, limit: 20 }, owner),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findOneRoom', () => {
    it('answers the room with both counts', async () => {
      findFirst.mockResolvedValue(activeRoom);

      expect(await service.findOneRoom(42, owner)).toEqual({
        id: 42,
        name: 'Fruit lovers',
        description: null,
        bannerUrl: '/uploads/banners/default.svg',
        visibility: 'public',
        status: 'active',
        endsAt: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        createdBy: { id: 7, username: 'pollpear' },
        memberCount: 3,
        pollCount: 2,
      });
    });

    it('never leaks the columns the policy reads', async () => {
      findFirst.mockResolvedValue(activeRoom);

      const answer = await service.findOneRoom(42, owner);

      expect(answer).not.toHaveProperty('deletedAt');
      expect(answer).not.toHaveProperty('createdById');
    });

    it('counts the polls the caller may read, not every live poll', async () => {
      findFirst.mockResolvedValue(activeRoom);

      await service.findOneRoom(42, owner);

      const { select } = findFirst.mock.calls[0][0] as unknown as {
        select: { _count: { select: { polls: { where: unknown } } } };
      };
      expect(select._count.select.polls.where).toEqual(
        accessibleBy(
          new CaslAbilityFactory().createForUser(owner),
          'read',
        ).ofType('Poll'),
      );
    });

    it('404s a room the caller may not see, exactly like a missing one', async () => {
      findFirst.mockResolvedValue(null);

      await expect(service.findOneRoom(42, stranger)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('createRoom', () => {
    const body = { name: 'Fruit lovers', visibility: 'public' as const };

    it('opens the room and takes its owner from the key, never the body', async () => {
      create.mockResolvedValue(activeRoom);

      await service.createRoom({ ...body, createdById: 999 } as never, owner);

      expect(create.mock.calls[0][0].data).toMatchObject({
        status: 'active',
        createdById: 7,
      });
    });

    it('seats the owner as a member in the very same write', async () => {
      create.mockResolvedValue(activeRoom);

      await service.createRoom(body, owner);

      const { roomMembers } = create.mock.calls[0][0].data as {
        roomMembers: { create: { userId: number; joinedAt: Date } };
      };
      expect(roomMembers.create.userId).toBe(7);
      expect(roomMembers.create.joinedAt).toBeInstanceOf(Date);
    });
  });

  describe('updateRoom', () => {
    it('lets the owner rename a room that is still active', async () => {
      findFirst.mockResolvedValue(activeRoom);
      update.mockResolvedValue({ ...activeRoom, name: 'Renamed' });

      await service.updateRoom(42, { name: 'Renamed' }, owner);

      expect(update.mock.calls[0][0].data).toEqual({ name: 'Renamed' });
    });

    it('409s the owner once the room is closed', async () => {
      findFirst.mockResolvedValue(closedRoom);

      await expect(
        service.updateRoom(42, { name: 'Renamed' }, owner),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(update).not.toHaveBeenCalled();
    });

    it('403s somebody who does not own the room', async () => {
      findFirst.mockResolvedValue(activeRoom);

      await expect(
        service.updateRoom(42, { name: 'Renamed' }, stranger),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('403s a moderator, who may delete a room but never edit one', async () => {
      findFirst.mockResolvedValue(activeRoom);

      await expect(
        service.updateRoom(42, { name: 'Renamed' }, moderator),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('403s an admin, whose reach over a room stops at reading it', async () => {
      findFirst.mockResolvedValue(activeRoom);

      await expect(
        service.updateRoom(42, { name: 'Renamed' }, admin),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('removeRoom', () => {
    it('soft deletes, leaving what the room holds where it is', async () => {
      findFirst.mockResolvedValue(activeRoom);
      update.mockResolvedValue(goneRoom);

      await service.removeRoom(42, owner);

      expect(update.mock.calls[0][0].data).toEqual({
        deletedAt: expect.any(Date) as Date,
      });
    });

    it('403s somebody who does not own the room', async () => {
      findFirst.mockResolvedValue(activeRoom);

      await expect(service.removeRoom(42, stranger)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(update).not.toHaveBeenCalled();
    });

    it('lets a moderator delete a room that is not theirs', async () => {
      findFirst.mockResolvedValue(activeRoom);
      update.mockResolvedValue(goneRoom);

      await service.removeRoom(42, moderator);

      expect(update).toHaveBeenCalled();
    });

    it('closes a room that is already gone without writing twice', async () => {
      findFirst.mockResolvedValue(goneRoom);

      await service.removeRoom(42, moderator);

      expect(update).not.toHaveBeenCalled();
    });

    it('deletes a closed room, which no status rule stands in the way of', async () => {
      findFirst.mockResolvedValue(closedRoom);
      update.mockResolvedValue(goneRoom);

      await service.removeRoom(42, owner);

      expect(update).toHaveBeenCalled();
    });
  });
  describe('the status reconciliation', () => {
    it('reports a room past its deadline as closed, and writes the flip', async () => {
      findFirst.mockResolvedValue(expiredRoom);
      updateMany.mockResolvedValue({ count: 1 });

      const answer = await service.findOneRoom(42, owner);

      expect(answer.status).toBe('closed');
      expect(updateMany.mock.calls[0][0]).toEqual({
        where: { id: { in: [42] }, status: 'active' },
        data: { status: 'closed' },
      });
    });

    it('writes nothing while the deadline is still ahead', async () => {
      findFirst.mockResolvedValue({
        ...activeRoom,
        endsAt: new Date('2030-01-01'),
      });

      await service.findOneRoom(42, owner);

      expect(updateMany).not.toHaveBeenCalled();
    });

    it('409s the owner editing a room past its deadline', async () => {
      findFirst.mockResolvedValue(expiredRoom);
      updateMany.mockResolvedValue({ count: 1 });

      await expect(
        service.updateRoom(42, { name: 'Renamed' }, owner),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(update).not.toHaveBeenCalled();
    });

    it('reconciles the rows of the list too', async () => {
      transaction.mockResolvedValue([
        [{ ...listedRoom, endsAt: new Date('2020-01-01') }],
        1,
      ]);
      updateMany.mockResolvedValue({ count: 1 });

      const answer = await service.findAllRooms(page, owner);

      expect(answer.data[0].status).toBe('closed');
    });
  });
  describe('the bulk sweep on the list', () => {
    it('closes every expired room before the filter reads the column', async () => {
      transaction.mockResolvedValue([[], 0]);
      updateMany.mockResolvedValue({ count: 2 });

      await service.findAllRooms({ ...page, status: 'active' }, owner);

      expect(updateMany.mock.calls[0][0]).toMatchObject({
        where: {
          status: 'active',
          deletedAt: null,
          endsAt: { not: null },
        },
        data: { status: 'closed' },
      });
      expect(updateMany.mock.invocationCallOrder[0]).toBeLessThan(
        transaction.mock.invocationCallOrder[0],
      );
    });
  });
});
