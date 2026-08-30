import { ForbiddenError } from '@casl/ability';
import { NotFoundException } from '@nestjs/common';
import {
  RoomCreateDTO,
  RoomReadSchema,
  RoomUpdateDTO,
} from 'Pollpear_shared/src/schemas/rooms.schema';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import type { User } from 'src/generated/prisma/client';
import { accessibleBy } from 'src/casl/casl-prisma';
import { PrismaService } from 'src/prisma/prisma.service';
import { PollsService } from 'src/polls/polls.service';
import { RoomsService, getRoomIncludeArgs } from './rooms.service';

function user(overrides: Record<string, unknown> = {}) {
  return { id: 42, role: 'user', ...overrides };
}

function viewer(overrides: Record<string, unknown> = {}) {
  return user(overrides) as unknown as User;
}

function room(overrides: Record<string, unknown> = {}) {
  return { id: 7, status: 'active', createdById: 42, ...overrides };
}

function createBody(overrides: Partial<RoomCreateDTO> = {}): RoomCreateDTO {
  return {
    name: 'Best pear variety?',
    visibility: 'public',
    ...overrides,
  };
}

function searchRow(id: number, name = `room${id}`) {
  return { id, name };
}

const REQUESTER_ID = 1;
const requesterViewer = { id: REQUESTER_ID, role: 'user' } as User;

describe('RoomsService', () => {
  const roomCreate = jest.fn();
  const roomUpdate = jest.fn();
  const roomUpdateMany = jest.fn();
  const roomFindFirst = jest.fn();
  const roomFindMany = jest.fn();
  const roomCount = jest.fn();
  const voteFindMany = jest.fn().mockResolvedValue([]);
  const prisma = {
    room: {
      create: roomCreate,
      update: roomUpdate,
      updateMany: roomUpdateMany,
      findFirst: roomFindFirst,
      findMany: roomFindMany,
      count: roomCount,
    },
    vote: { findMany: voteFindMany },
  } as unknown as PrismaService;
  const shapeManyPollsForUser = jest.fn((polls: unknown[]) => polls);
  const pollsService = {
    shapeManyPollsForUser,
  } as unknown as PollsService;
  const abilityFactory = new CaslAbilityFactory();
  const service = new RoomsService(prisma, abilityFactory, pollsService);

  // The CASL room-read policy (permissions/room.ts) is the single source of
  // truth for "what can this user see". Rather than re-typing its conditions
  // by hand here (which drifts the moment the policy changes), tests derive
  // the expected `where` clause the same way the service does: by running
  // the real ability through `accessibleBy`.
  function abilityFor(u: ReturnType<typeof user>) {
    return abilityFactory.createForUser(
      u as unknown as { id: number; role: 'user' | 'moderator' | 'admin' },
    );
  }

  function readAccessibleWhere(u: ReturnType<typeof user>) {
    return accessibleBy(abilityFor(u), 'read').ofType('Room');
  }

  // findOneRoom runs the fetched room through RoomReadSchema.parse, which
  // enforces the full Prisma-generated shape. These tests care about the
  // service's own logic (query shape, what gets returned), not re-validating
  // that shared schema, so `parse` is stubbed to just return whatever it's given.
  jest
    .spyOn(RoomReadSchema, 'parse')
    .mockImplementation(
      (value) => value as ReturnType<typeof RoomReadSchema.parse>,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    voteFindMany.mockResolvedValue([]);
  });

  describe('create', () => {
    it('forces active status and adds the caller as the first room member', async () => {
      const body = createBody();

      await service.create(viewer(), body);

      expect(roomCreate).toHaveBeenCalledWith({
        data: {
          ...body,
          createdById: 42,
          status: 'active',
          roomMembers: {
            create: { userId: 42, joinedAt: expect.any(Date) as Date },
          },
        },
      });
    });

    it('returns whatever prisma.room.create resolves', async () => {
      const created = { id: 7, ...createBody() };
      roomCreate.mockResolvedValue(created);

      await expect(service.create(viewer(), createBody())).resolves.toBe(
        created,
      );
    });
  });

  describe('update', () => {
    const body: RoomUpdateDTO = { name: 'Renamed' };

    it('refuses an update from anyone but the owner', async () => {
      roomFindFirst.mockResolvedValue(room());

      await expect(service.update(7, viewer({ id: 43 }), body)).rejects.toThrow(
        ForbiddenError,
      );
      expect(roomUpdate).not.toHaveBeenCalled();
    });

    // The `['status']`-scoped update rule (permissions/room.ts) is the only
    // thing an owner may change on a closed room — to reopen it.
    it('lets the owner reopen a closed room by touching only status', async () => {
      roomFindFirst.mockResolvedValue(room({ status: 'closed' }));
      const reopen = { status: 'active' } as unknown as RoomUpdateDTO;

      await service.update(7, viewer(), reopen);

      expect(roomUpdate).toHaveBeenCalledWith({
        where: { id: 7 },
        data: reopen,
      });
    });

    it('refuses the owner editing a non-status field on a closed room', async () => {
      roomFindFirst.mockResolvedValue(room({ status: 'closed' }));

      await expect(service.update(7, viewer(), body)).rejects.toThrow(
        ForbiddenError,
      );
      expect(roomUpdate).not.toHaveBeenCalled();
    });

    it('lets the owner update an active room', async () => {
      roomFindFirst.mockResolvedValue(room());

      await service.update(7, viewer(), body);

      expect(roomUpdate).toHaveBeenCalledWith({
        where: { id: 7 },
        data: body,
      });
    });

    it('throws not-found for a missing room', async () => {
      roomFindFirst.mockResolvedValue(null);

      await expect(service.update(7, viewer(), body)).rejects.toThrow(
        NotFoundException,
      );
      expect(roomUpdate).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('lets the room owner soft-delete their own room', async () => {
      roomFindFirst.mockResolvedValue(room({ createdById: 42 }));

      await service.remove(7, viewer({ id: 42, role: 'user' }));

      expect(roomUpdate).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { deletedAt: expect.any(Date) as Date },
      });
    });

    it('refuses removal from a non-owner, non-admin user', async () => {
      roomFindFirst.mockResolvedValue(room({ createdById: 42 }));

      await expect(
        service.remove(7, viewer({ id: 99, role: 'user' })),
      ).rejects.toThrow(ForbiddenError);
      expect(roomUpdate).not.toHaveBeenCalled();
    });

    it('lets an admin soft-delete a room they do not own', async () => {
      roomFindFirst.mockResolvedValue(room({ createdById: 42 }));

      await service.remove(7, viewer({ id: 1, role: 'admin' }));

      expect(roomUpdate).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { deletedAt: expect.any(Date) as Date },
      });
    });

    it('throws not-found for a missing room', async () => {
      roomFindFirst.mockResolvedValue(null);

      await expect(
        service.remove(7, viewer({ role: 'admin' })),
      ).rejects.toThrow(NotFoundException);
      expect(roomUpdate).not.toHaveBeenCalled();
    });
  });

  describe('findOneRoom', () => {
    it('queries the room restricted to what the requester can read', async () => {
      const found = { id: 7, name: 'Best pear variety?', polls: [] };
      roomFindFirst.mockResolvedValueOnce(found);

      await service.findOneRoom(7, viewer());

      expect(roomFindFirst).toHaveBeenCalledWith({
        where: {
          AND: [
            readAccessibleWhere(user({ id: 42 })),
            { id: 7, deletedAt: null },
          ],
        },
        include: getRoomIncludeArgs(42, abilityFor(user({ id: 42 }))),
      });
    });

    it('throws not-found for a room the requester cannot read or that does not exist', async () => {
      roomFindFirst.mockResolvedValueOnce(null);

      await expect(service.findOneRoom(7, viewer())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('shapes each poll for the requesting user and returns the room with them', async () => {
      const poll = { id: 1 };
      const found = { id: 7, name: 'Best pear variety?', polls: [poll] };
      roomFindFirst.mockResolvedValueOnce(found);

      const result = await service.findOneRoom(7, viewer());

      expect(shapeManyPollsForUser).toHaveBeenCalledWith([poll], []);
      expect(result).toEqual({ ...found, polls: [poll] });
    });
  });

  describe('findMeManyRooms', () => {
    it('queries rooms the requester created, restricted to what they can read', async () => {
      roomFindMany.mockResolvedValue([]);

      await service.findMeManyRooms(viewer());

      expect(roomFindMany).toHaveBeenCalledWith({
        where: {
          AND: [
            readAccessibleWhere(user({ id: 42 })),
            { createdById: 42, deletedAt: null },
          ],
        },
        include: getRoomIncludeArgs(42, abilityFor(user({ id: 42 }))),
      });
    });

    it("shapes each room's polls for the requesting user and returns every room", async () => {
      const pollA = { id: 1 };
      const pollB = { id: 2 };
      const roomA = { id: 7, name: 'Best pear variety?', polls: [pollA] };
      const roomB = { id: 8, name: 'Worst pear variety?', polls: [pollB] };
      roomFindMany.mockResolvedValue([roomA, roomB]);

      const result = await service.findMeManyRooms(viewer());

      expect(shapeManyPollsForUser).toHaveBeenCalledWith([pollA], []);
      expect(shapeManyPollsForUser).toHaveBeenCalledWith([pollB], []);
      expect(result).toEqual([
        { ...roomA, polls: [pollA] },
        { ...roomB, polls: [pollB] },
      ]);
    });
  });

  describe('findManyRooms', () => {
    it('queries rooms the requester created, joined, or that are public, restricted to what they can read', async () => {
      roomFindMany.mockResolvedValue([]);

      await service.findManyRooms(viewer());

      expect(roomFindMany).toHaveBeenCalledWith({
        where: {
          AND: [
            readAccessibleWhere(user({ id: 42 })),
            {
              OR: [
                { createdById: 42, deletedAt: null },
                { visibility: 'public', deletedAt: null },
                { roomMembers: { some: { userId: 42 } }, deletedAt: null },
              ],
            },
          ],
        },
        include: getRoomIncludeArgs(42, abilityFor(user({ id: 42 }))),
      });
    });

    it("shapes each room's polls for the requesting user and returns every room", async () => {
      const poll = { id: 1 };
      const found = { id: 7, name: 'Best pear variety?', polls: [poll] };
      roomFindMany.mockResolvedValue([found]);

      const result = await service.findManyRooms(viewer());

      expect(shapeManyPollsForUser).toHaveBeenCalledWith([poll], []);
      expect(result).toEqual([{ ...found, polls: [poll] }]);
    });
  });

  describe('findUsersManyRooms', () => {
    it("queries the target user's rooms visible to the requester", async () => {
      roomFindMany.mockResolvedValue([]);

      await service.findUsersManyRooms(viewer(), 99);

      expect(roomFindMany).toHaveBeenCalledWith({
        where: {
          AND: [
            readAccessibleWhere(user({ id: 42 })),
            { createdById: 99, deletedAt: null },
          ],
        },
        include: getRoomIncludeArgs(42, abilityFor(user({ id: 42 }))),
      });
    });

    it("shapes each room's polls for the requesting user and returns every room", async () => {
      const poll = { id: 1 };
      const found = { id: 7, name: 'Best pear variety?', polls: [poll] };
      roomFindMany.mockResolvedValue([found]);

      const result = await service.findUsersManyRooms(viewer(), 99);

      expect(shapeManyPollsForUser).toHaveBeenCalledWith([poll], []);
      expect(result).toEqual([{ ...found, polls: [poll] }]);
    });
  });

  describe('search', () => {
    // Derived from the CASL room-read policy for a plain 'user' role: public
    // rooms, or rooms the requester is a member of.
    const baseWhere = () => ({
      deletedAt: null,
      ...readAccessibleWhere(user({ id: REQUESTER_ID })),
    });
    const matchWhere = (q: string) => ({
      ...baseWhere(),
      name: { contains: q, mode: 'insensitive' },
    });
    const startsWithWhere = (q: string) => ({
      ...baseWhere(),
      name: { startsWith: q, mode: 'insensitive' },
    });

    it('ranks name prefixes first and fills the rest with contains matches', async () => {
      const prefixed = [searchRow(1, 'room-a'), searchRow(2, 'room-ab')];
      const contained = [searchRow(3, 'the-room-abc')];
      roomCount.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
      roomFindMany
        .mockResolvedValueOnce(prefixed)
        .mockResolvedValueOnce(contained);

      await expect(service.search('room', requesterViewer)).resolves.toEqual({
        items: [...prefixed, ...contained],
        total: 3,
      });

      expect(roomCount).toHaveBeenNthCalledWith(1, {
        where: matchWhere('room'),
      });
      expect(roomCount).toHaveBeenNthCalledWith(2, {
        where: startsWithWhere('room'),
      });
      expect(roomFindMany).toHaveBeenNthCalledWith(1, {
        where: startsWithWhere('room'),
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        skip: 0,
        take: 5,
      });
      expect(roomFindMany).toHaveBeenNthCalledWith(2, {
        where: {
          ...matchWhere('room'),
          NOT: { name: { startsWith: 'room', mode: 'insensitive' } },
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        skip: 0,
        take: 3,
      });
    });

    it('orders alphabetically without the prefix phase when sortBy is alphabetical', async () => {
      const alphabetical = [searchRow(1, 'alpha'), searchRow(2, 'bravo')];
      roomCount.mockResolvedValueOnce(2);
      roomFindMany.mockResolvedValueOnce(alphabetical);

      await expect(
        service.search('a', requesterViewer, { sortBy: 'alphabetical' }),
      ).resolves.toEqual({ items: alphabetical, total: 2 });

      expect(roomCount).toHaveBeenCalledTimes(1);
      expect(roomFindMany).toHaveBeenCalledTimes(1);
      expect(roomFindMany).toHaveBeenCalledWith({
        where: matchWhere('a'),
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        skip: 0,
        take: 5,
      });
    });

    it('paginates with page/limit', async () => {
      const page2 = [searchRow(11)];
      roomCount.mockResolvedValueOnce(11).mockResolvedValueOnce(11);
      roomFindMany.mockResolvedValueOnce(page2).mockResolvedValueOnce([]);

      await expect(
        service.search('room', requesterViewer, { page: 3, limit: 5 }),
      ).resolves.toEqual({ items: page2, total: 11 });

      expect(roomFindMany).toHaveBeenCalledWith({
        where: startsWithWhere('room'),
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        skip: 10,
        take: 5,
      });
    });
  });
});
