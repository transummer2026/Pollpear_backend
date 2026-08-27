import { ForbiddenError } from '@casl/ability';
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
  const roomFindUniqueOrThrow = jest.fn();
  const roomFindMany = jest.fn();
  const roomCount = jest.fn();
  const userFindUniqueOrThrow = jest.fn();
  const voteFindMany = jest.fn().mockResolvedValue([]);
  const prisma = {
    room: {
      create: roomCreate,
      update: roomUpdate,
      findUniqueOrThrow: roomFindUniqueOrThrow,
      findMany: roomFindMany,
      count: roomCount,
    },
    user: { findUniqueOrThrow: userFindUniqueOrThrow },
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
  function readAccessibleWhere(u: ReturnType<typeof user>) {
    const ability = abilityFactory.createForUser(
      u as unknown as { id: number; role: 'user' | 'moderator' | 'admin' },
    );
    return accessibleBy(ability, 'read').ofType('Room');
  }

  // findMeOneRoom runs the fetched room through RoomReadSchema.parse, which
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

      await service.create(42, body);

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

      await expect(service.create(42, createBody())).resolves.toBe(created);
    });
  });

  describe('update', () => {
    const body: RoomUpdateDTO = { name: 'Renamed' };

    it('refuses an update from anyone but the owner', async () => {
      userFindUniqueOrThrow.mockResolvedValue(user({ id: 43 }));
      roomFindUniqueOrThrow.mockResolvedValue(room());

      await expect(service.update(7, 43, body)).rejects.toThrow(ForbiddenError);
      expect(roomUpdate).not.toHaveBeenCalled();
    });

    it('lets the owner update a closed room', async () => {
      userFindUniqueOrThrow.mockResolvedValue(user());
      roomFindUniqueOrThrow.mockResolvedValue(room({ status: 'closed' }));

      await service.update(7, 42, body);

      expect(roomUpdate).toHaveBeenCalledWith({
        where: { id: 7 },
        data: body,
      });
    });

    it('lets the owner update an active room', async () => {
      userFindUniqueOrThrow.mockResolvedValue(user());
      roomFindUniqueOrThrow.mockResolvedValue(room());

      await service.update(7, 42, body);

      expect(roomUpdate).toHaveBeenCalledWith({
        where: { id: 7 },
        data: body,
      });
    });

    it('propagates the not-found rejection for a missing room', async () => {
      userFindUniqueOrThrow.mockResolvedValue(user());
      const notFound = new Error('not found');
      roomFindUniqueOrThrow.mockRejectedValue(notFound);

      await expect(service.update(7, 42, body)).rejects.toBe(notFound);
      expect(roomUpdate).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('lets the room owner soft-delete their own room', async () => {
      userFindUniqueOrThrow.mockResolvedValue(user({ id: 42, role: 'user' }));
      roomFindUniqueOrThrow.mockResolvedValue(room({ createdById: 42 }));

      await service.remove(7, 42);

      expect(roomUpdate).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { deletedAt: expect.any(Date) as Date },
      });
    });

    it('refuses removal from a non-owner, non-admin user', async () => {
      userFindUniqueOrThrow.mockResolvedValue(user({ id: 99, role: 'user' }));
      roomFindUniqueOrThrow.mockResolvedValue(room({ createdById: 42 }));

      await expect(service.remove(7, 99)).rejects.toThrow(ForbiddenError);
      expect(roomUpdate).not.toHaveBeenCalled();
    });

    it('lets an admin soft-delete a room they do not own', async () => {
      userFindUniqueOrThrow.mockResolvedValue(user({ id: 1, role: 'admin' }));
      roomFindUniqueOrThrow.mockResolvedValue(room({ createdById: 42 }));

      await service.remove(7, 1);

      expect(roomUpdate).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { deletedAt: expect.any(Date) as Date },
      });
    });

    it('propagates the not-found rejection for a missing room', async () => {
      userFindUniqueOrThrow.mockResolvedValue(user({ role: 'admin' }));
      const notFound = new Error('not found');
      roomFindUniqueOrThrow.mockRejectedValue(notFound);

      await expect(service.remove(7, 42)).rejects.toBe(notFound);
      expect(roomUpdate).not.toHaveBeenCalled();
    });
  });

  describe('findMeOneRoom', () => {
    beforeEach(() => {
      userFindUniqueOrThrow.mockResolvedValue(user());
    });

    it('checks read access on the room, then queries it with members/messages/polls/invitations', async () => {
      const abilityCheckRoom = {
        id: 7,
        visibility: 'public',
        deletedAt: null,
        roomMembers: [],
      };
      const found = { id: 7, name: 'Best pear variety?', polls: [] };
      roomFindUniqueOrThrow
        .mockResolvedValueOnce(abilityCheckRoom)
        .mockResolvedValueOnce(found);

      await service.findMeOneRoom(7, 42);

      expect(roomFindUniqueOrThrow).toHaveBeenNthCalledWith(1, {
        where: { id: 7, deletedAt: null },
        include: { roomMembers: { where: { deletedAt: null } } },
      });
      expect(roomFindUniqueOrThrow).toHaveBeenNthCalledWith(2, {
        where: { id: 7, deletedAt: null },
        include: getRoomIncludeArgs(42),
      });
    });

    it('refuses a room the requester cannot read', async () => {
      const privateRoom = {
        id: 7,
        visibility: 'private',
        deletedAt: null,
        roomMembers: [],
      };
      roomFindUniqueOrThrow.mockResolvedValueOnce(privateRoom);

      await expect(service.findMeOneRoom(7, 42)).rejects.toThrow(
        ForbiddenError,
      );
    });

    it('shapes each poll for the requesting user and returns the room with them', async () => {
      const poll = { id: 1 };
      const abilityCheckRoom = {
        id: 7,
        visibility: 'public',
        deletedAt: null,
        roomMembers: [],
      };
      const found = { id: 7, name: 'Best pear variety?', polls: [poll] };
      roomFindUniqueOrThrow
        .mockResolvedValueOnce(abilityCheckRoom)
        .mockResolvedValueOnce(found);

      const result = await service.findMeOneRoom(7, 42);

      expect(shapeManyPollsForUser).toHaveBeenCalledWith([poll], []);
      expect(result).toEqual({ ...found, polls: [poll] });
    });
  });

  describe('findMeManyRooms', () => {
    beforeEach(() => {
      userFindUniqueOrThrow.mockResolvedValue(user({ id: 42 }));
    });

    it('queries rooms the requester created, restricted to what they can read', async () => {
      roomFindMany.mockResolvedValue([]);

      await service.findMeManyRooms(42);

      expect(roomFindMany).toHaveBeenCalledWith({
        where: {
          AND: [
            readAccessibleWhere(user({ id: 42 })),
            { createdById: 42, deletedAt: null },
          ],
        },
        include: getRoomIncludeArgs(42),
      });
    });

    it("shapes each room's polls for the requesting user and returns every room", async () => {
      const pollA = { id: 1 };
      const pollB = { id: 2 };
      const roomA = { id: 7, name: 'Best pear variety?', polls: [pollA] };
      const roomB = { id: 8, name: 'Worst pear variety?', polls: [pollB] };
      roomFindMany.mockResolvedValue([roomA, roomB]);

      const result = await service.findMeManyRooms(42);

      expect(shapeManyPollsForUser).toHaveBeenCalledWith([pollA], []);
      expect(shapeManyPollsForUser).toHaveBeenCalledWith([pollB], []);
      expect(result).toEqual([
        { ...roomA, polls: [pollA] },
        { ...roomB, polls: [pollB] },
      ]);
    });
  });

  describe('findManyRooms', () => {
    beforeEach(() => {
      userFindUniqueOrThrow.mockResolvedValue(user({ id: 42 }));
    });

    it('queries rooms the requester created, joined, or that are public, restricted to what they can read', async () => {
      roomFindMany.mockResolvedValue([]);

      await service.findManyRooms(42);

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
        include: getRoomIncludeArgs(42),
      });
    });

    it("shapes each room's polls for the requesting user and returns every room", async () => {
      const poll = { id: 1 };
      const found = { id: 7, name: 'Best pear variety?', polls: [poll] };
      roomFindMany.mockResolvedValue([found]);

      const result = await service.findManyRooms(42);

      expect(shapeManyPollsForUser).toHaveBeenCalledWith([poll], []);
      expect(result).toEqual([{ ...found, polls: [poll] }]);
    });
  });

  describe('findUsersManyRooms', () => {
    beforeEach(() => {
      userFindUniqueOrThrow.mockResolvedValue(user({ id: 42 }));
    });

    it("queries the target user's rooms visible to the requester", async () => {
      roomFindMany.mockResolvedValue([]);

      await service.findUsersManyRooms(42, 99);

      expect(roomFindMany).toHaveBeenCalledWith({
        where: {
          AND: [
            readAccessibleWhere(user({ id: 42 })),
            {
              OR: [
                { createdById: 99, deletedAt: null },
                { visibility: 'public', deletedAt: null },
                { roomMembers: { some: { userId: 42 } }, deletedAt: null },
              ],
            },
          ],
        },
        include: getRoomIncludeArgs(42),
      });
    });

    it("shapes each room's polls for the requesting user and returns every room", async () => {
      const poll = { id: 1 };
      const found = { id: 7, name: 'Best pear variety?', polls: [poll] };
      roomFindMany.mockResolvedValue([found]);

      const result = await service.findUsersManyRooms(42, 99);

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
