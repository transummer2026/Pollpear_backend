import { ForbiddenError } from '@casl/ability';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
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
import { NotificationService } from 'src/notification/notification.service';
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
  const roomMemberFindFirst = jest.fn();
  const roomMemberFindUnique = jest.fn();
  const roomMemberUpdate = jest.fn();
  const roomMemberCreate = jest.fn();
  const invitationUpdateMany = jest.fn();
  const invitationFindFirst = jest.fn();
  const transaction = jest.fn((ops: Promise<unknown>[]) => Promise.all(ops));
  const prisma = {
    room: {
      create: roomCreate,
      update: roomUpdate,
      updateMany: roomUpdateMany,
      findFirst: roomFindFirst,
      findMany: roomFindMany,
      count: roomCount,
    },
    roomMember: {
      findFirst: roomMemberFindFirst,
      findUnique: roomMemberFindUnique,
      update: roomMemberUpdate,
      create: roomMemberCreate,
    },
    invitation: {
      updateMany: invitationUpdateMany,
      findFirst: invitationFindFirst,
    },
    vote: { findMany: voteFindMany },
    $transaction: transaction,
  } as unknown as PrismaService;
  const shapeManyPollsForUser = jest.fn((polls: unknown[]) => polls);
  const pollsService = {
    shapeManyPollsForUser,
  } as unknown as PollsService;
  const abilityFactory = new CaslAbilityFactory();
  const clearRoomNotifications = jest.fn();
  const notificationService = {
    clearRoomNotifications,
  } as unknown as NotificationService;
  const service = new RoomsService(
    prisma,
    abilityFactory,
    pollsService,
    notificationService,
  );

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

  function joinAccessibleWhere(u: ReturnType<typeof user>) {
    return accessibleBy(abilityFor(u), 'join').ofType('Room');
  }

  function kickAccessibleWhere(u: ReturnType<typeof user>) {
    return accessibleBy(abilityFor(u), 'kick').ofType('Room');
  }

  function leaveAccessibleWhere(u: ReturnType<typeof user>) {
    return accessibleBy(abilityFor(u), 'leave').ofType('Room');
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
        data: { deletedAt: expect.any(Date) as Date, status: 'closed' },
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
        data: { deletedAt: expect.any(Date) as Date, status: 'closed' },
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

  describe('addParticipant', () => {
    beforeEach(() => {
      roomFindFirst.mockResolvedValue(room());
    });

    it('queries the room restricted to what the caller may join', async () => {
      roomMemberFindUnique.mockResolvedValue(null);
      roomMemberCreate.mockResolvedValue({ id: 1 });

      await service.addParticipant(viewer({ id: 42 }), 7);

      expect(roomFindFirst).toHaveBeenCalledWith({
        where: {
          AND: [
            joinAccessibleWhere(user({ id: 42 })),
            { id: 7, deletedAt: null },
          ],
        },
      });
    });

    it('creates a fresh membership when none exists', async () => {
      roomMemberFindUnique.mockResolvedValue(null);
      const created = { id: 1, roomId: 7, userId: 42 };
      roomMemberCreate.mockResolvedValue(created);

      const result = await service.addParticipant(viewer({ id: 42 }), 7);

      expect(roomMemberCreate).toHaveBeenCalledWith({
        data: { roomId: 7, userId: 42, joinedAt: expect.any(Date) as Date },
      });
      expect(roomMemberUpdate).not.toHaveBeenCalled();
      expect(result).toBe(created);
    });

    it('reactivates a soft-deleted membership with a fresh joinedAt', async () => {
      roomMemberFindUnique.mockResolvedValue({ id: 9, deletedAt: new Date() });
      roomMemberUpdate.mockResolvedValue({ id: 9 });

      await service.addParticipant(viewer({ id: 42 }), 7);

      expect(roomMemberUpdate).toHaveBeenCalledWith({
        where: { id: 9 },
        data: { deletedAt: null, joinedAt: expect.any(Date) as Date },
      });
      expect(roomMemberCreate).not.toHaveBeenCalled();
    });

    it('is an idempotent no-op for an already-active member and never rewrites joinedAt', async () => {
      const active = {
        id: 9,
        deletedAt: null,
        joinedAt: new Date('2020-01-01'),
      };
      roomMemberFindUnique.mockResolvedValue(active);

      const result = await service.addParticipant(viewer({ id: 42 }), 7);

      expect(result).toBe(active);
      expect(roomMemberUpdate).not.toHaveBeenCalled();
      expect(roomMemberCreate).not.toHaveBeenCalled();
    });

    it('throws not-found when the room is not joinable for the caller', async () => {
      roomFindFirst.mockResolvedValue(null);

      await expect(
        service.addParticipant(viewer({ id: 42 }), 7),
      ).rejects.toThrow(NotFoundException);
      expect(roomMemberFindUnique).not.toHaveBeenCalled();
      expect(roomMemberCreate).not.toHaveBeenCalled();
    });

    it('runs against a caller-supplied ability and transaction client', async () => {
      const txRoomFindFirst = jest.fn().mockResolvedValue(room());
      const txMemberFindUnique = jest.fn().mockResolvedValue(null);
      const txMemberCreate = jest.fn().mockResolvedValue({ id: 1 });
      const tx = {
        room: { findFirst: txRoomFindFirst },
        roomMember: {
          findUnique: txMemberFindUnique,
          create: txMemberCreate,
        },
      } as unknown as Parameters<typeof service.addParticipant>[3];
      const ability = abilityFor(user({ id: 42 }));

      await service.addParticipant(viewer({ id: 42 }), 7, ability, tx);

      expect(txRoomFindFirst).toHaveBeenCalled();
      expect(txMemberCreate).toHaveBeenCalled();
      // the service's own prisma client is untouched
      expect(roomFindFirst).not.toHaveBeenCalled();
      expect(roomMemberCreate).not.toHaveBeenCalled();
    });
  });

  describe('removeParticipant', () => {
    beforeEach(() => {
      roomFindFirst.mockResolvedValue(room());
      roomMemberFindFirst.mockResolvedValue({ id: 55 });
      roomMemberUpdate.mockResolvedValue({ id: 55, deletedAt: new Date() });
      invitationUpdateMany.mockResolvedValue({ count: 1 });
      invitationFindFirst.mockResolvedValue({ inviterId: 9 });
    });

    // targetUserId !== viewer.id -> "kick": the room lookup is gated by the
    // CASL `kick` rule, and the removal also revokes the target's accepted
    // invitation so `roomJoinConditions` can't let them straight back in.
    it('kicks a member: soft-deletes the row and revokes the accepted invitation in one transaction', async () => {
      const owner = viewer({ id: 42 });

      const result = await service.removeParticipant(owner, 7, 99);

      expect(roomFindFirst).toHaveBeenCalledWith({
        where: {
          AND: [
            kickAccessibleWhere(user({ id: 42 })),
            { id: 7, deletedAt: null },
          ],
        },
      });
      expect(roomMemberFindFirst).toHaveBeenCalledWith({
        where: { roomId: 7, userId: 99, deletedAt: null },
      });
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(roomMemberUpdate).toHaveBeenCalledWith({
        where: { id: 55 },
        data: { deletedAt: expect.any(Date) as Date },
      });
      expect(invitationUpdateMany).toHaveBeenCalledWith({
        where: {
          roomId: 7,
          inviteeId: 99,
          status: 'accepted',
          deletedAt: null,
        },
        data: { deletedAt: expect.any(Date) as Date },
      });
      // both sides' room notifications are cleared: (formerMember, inviter)
      expect(clearRoomNotifications).toHaveBeenCalledWith(99, 9);
      // returns the member row, not the invitation updateMany result
      expect(result).toEqual({ id: 55, deletedAt: expect.any(Date) as Date });
    });

    it('revokes the invitation the same way when a moderator kicks (no per-actor scoping)', async () => {
      const moderator = viewer({ id: 1, role: 'moderator' });

      await service.removeParticipant(moderator, 7, 99);

      expect(invitationUpdateMany).toHaveBeenCalledWith({
        where: {
          roomId: 7,
          inviteeId: 99,
          status: 'accepted',
          deletedAt: null,
        },
        data: { deletedAt: expect.any(Date) as Date },
      });
    });

    it('refuses to kick the room owner (a moderator cannot remove them)', async () => {
      const moderator = viewer({ id: 1, role: 'moderator' });

      await expect(service.removeParticipant(moderator, 7, 42)).rejects.toThrow(
        ForbiddenException,
      );
      expect(transaction).not.toHaveBeenCalled();
      expect(roomMemberUpdate).not.toHaveBeenCalled();
      expect(invitationUpdateMany).not.toHaveBeenCalled();
    });

    it('refuses to let the owner leave their own room', async () => {
      const owner = viewer({ id: 42 });

      await expect(service.removeParticipant(owner, 7, 42)).rejects.toThrow(
        ForbiddenException,
      );
      expect(roomMemberFindFirst).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
      expect(roomMemberUpdate).not.toHaveBeenCalled();
      expect(invitationUpdateMany).not.toHaveBeenCalled();
    });

    // targetUserId === viewer.id -> "leave": gated by the CASL `leave` rule,
    // and — like a kick — it revokes the caller's accepted invitation too, so
    // coming back to a private room needs a fresh invitation.
    it('leaves a room: soft-deletes the membership and revokes the accepted invitation in one transaction', async () => {
      const self = viewer({ id: 77 });

      const result = await service.removeParticipant(self, 7, 77);

      expect(roomFindFirst).toHaveBeenCalledWith({
        where: {
          AND: [
            leaveAccessibleWhere(user({ id: 77 })),
            { id: 7, deletedAt: null },
          ],
        },
      });
      expect(roomMemberFindFirst).toHaveBeenCalledWith({
        where: { roomId: 7, userId: 77, deletedAt: null },
      });
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(roomMemberUpdate).toHaveBeenCalledWith({
        where: { id: 55 },
        data: { deletedAt: expect.any(Date) as Date },
      });
      expect(invitationUpdateMany).toHaveBeenCalledWith({
        where: {
          roomId: 7,
          inviteeId: 77,
          status: 'accepted',
          deletedAt: null,
        },
        data: { deletedAt: expect.any(Date) as Date },
      });
      expect(clearRoomNotifications).toHaveBeenCalledWith(77, 9);
      expect(result).toEqual({ id: 55, deletedAt: expect.any(Date) as Date });
    });

    it('skips notification clearing when the member had no accepted invitation', async () => {
      invitationFindFirst.mockResolvedValue(null);

      await service.removeParticipant(viewer({ id: 77 }), 7, 77);

      expect(clearRoomNotifications).not.toHaveBeenCalled();
    });

    it('throws not-found when the room is not accessible for the action', async () => {
      roomFindFirst.mockResolvedValue(null);

      await expect(
        service.removeParticipant(viewer({ id: 42 }), 7, 99),
      ).rejects.toThrow(NotFoundException);
      expect(roomMemberUpdate).not.toHaveBeenCalled();
      expect(invitationUpdateMany).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
    });

    it('throws not-found when the target is not an active member', async () => {
      roomMemberFindFirst.mockResolvedValue(null);

      await expect(
        service.removeParticipant(viewer({ id: 42 }), 7, 99),
      ).rejects.toThrow(NotFoundException);
      expect(roomMemberUpdate).not.toHaveBeenCalled();
      expect(invitationUpdateMany).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
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
        include: getRoomIncludeArgs(abilityFor(user({ id: 42 }))),
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
        include: getRoomIncludeArgs(abilityFor(user({ id: 42 }))),
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
        include: getRoomIncludeArgs(abilityFor(user({ id: 42 }))),
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
        include: getRoomIncludeArgs(abilityFor(user({ id: 42 }))),
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
