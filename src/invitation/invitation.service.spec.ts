import { NotFoundException } from '@nestjs/common';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { NotificationService } from 'src/notification/notification.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RoomsService } from 'src/rooms/rooms.service';
import type { User } from 'src/generated/prisma/client';
import { InvitationReadSchema } from 'Pollpear_shared/src/schemas/invitations.schema';
import { InvitationService } from './invitation.service';

describe('InvitationService', () => {
  const roomFindFirst = jest.fn();
  const userFindFirst = jest.fn();
  const invitationFindFirst = jest.fn();
  const invitationFindUnique = jest.fn();
  const invitationFindMany = jest.fn();
  const invitationUpdateMany = jest.fn();
  const invitationUpsert = jest.fn();
  const invitationUpdate = jest.fn();
  const transaction = jest.fn((cb: (tx: unknown) => unknown) => cb(prisma));
  const prisma = {
    room: { findFirst: roomFindFirst },
    user: { findFirst: userFindFirst },
    invitation: {
      findFirst: invitationFindFirst,
      findUnique: invitationFindUnique,
      findMany: invitationFindMany,
      updateMany: invitationUpdateMany,
      upsert: invitationUpsert,
      update: invitationUpdate,
    },
    $transaction: transaction,
  } as unknown as PrismaService;
  const abilityFactory = new CaslAbilityFactory();
  const notifyRoomInvitation = jest.fn();
  const notifyRoomInvitationAccepted = jest.fn();
  const clearRoomInvitation = jest.fn();
  const notificationService = {
    notifyRoomInvitation,
    notifyRoomInvitationAccepted,
    clearRoomInvitation,
  } as unknown as NotificationService;
  const addParticipant = jest.fn();
  const roomsService = { addParticipant } as unknown as RoomsService;

  const service = new InvitationService(
    prisma,
    abilityFactory,
    notificationService,
    roomsService,
  );

  // These tests exercise updateRoomInvitation's own logic (transaction shape,
  // ordering of side effects), not the shared read schema.
  jest
    .spyOn(InvitationReadSchema, 'parse')
    .mockImplementation(
      (value) => value as ReturnType<typeof InvitationReadSchema.parse>,
    );

  const viewer = { id: 5, role: 'user' } as User;

  function pendingInvitation(overrides: Record<string, unknown> = {}) {
    return {
      id: 1,
      roomId: 7,
      inviteeId: 5,
      inviterId: 9,
      status: 'pending',
      deletedAt: null,
      invitee: { id: 5 },
      inviter: { id: 9 },
      room: { id: 7, name: 'Pear room' },
      ...overrides,
    };
  }

  beforeEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMyInvitations', () => {
    it('returns the viewer’s pending invitations, scoped to the invitee side', async () => {
      const rows = [
        pendingInvitation(),
        pendingInvitation({ id: 2, roomId: 8, inviterId: 12 }),
      ];
      invitationFindMany.mockResolvedValue(rows);

      const result = await service.getMyInvitations(viewer);

      expect(result).toEqual(rows);
      const [{ where }] = invitationFindMany.mock.calls[0] as [
        { where: { AND: unknown[] } },
      ];
      expect(where.AND).toEqual(
        expect.arrayContaining([
          { inviteeId: viewer.id, status: 'pending', deletedAt: null },
        ]),
      );
    });

    it('returns an empty list when the viewer has no pending invitation', async () => {
      invitationFindMany.mockResolvedValue([]);

      await expect(service.getMyInvitations(viewer)).resolves.toEqual([]);
    });
  });

  describe('updateRoomInvitation', () => {
    it('accepting flips the row and joins the room inside one transaction, then notifies', async () => {
      invitationFindFirst.mockResolvedValue(pendingInvitation());
      invitationUpdateMany.mockResolvedValue({ count: 1 });
      const accepted = pendingInvitation({ status: 'accepted' });
      invitationFindUnique.mockResolvedValue(accepted);
      addParticipant.mockResolvedValue({ id: 1 });

      const result = await service.updateRoomInvitation(
        viewer,
        7,
        5,
        'accepted',
      );

      expect(transaction).toHaveBeenCalledTimes(1);
      expect(addParticipant).toHaveBeenCalledWith(
        viewer,
        7,
        expect.anything(),
        prisma,
      );
      expect(clearRoomInvitation).toHaveBeenCalledWith(5, 9);
      expect(notifyRoomInvitationAccepted).toHaveBeenCalledWith(
        9,
        5,
        'Pear room',
      );
      expect(result).toBe(accepted);
    });

    it('rolls back and sends no notification when the join fails (e.g. room since closed)', async () => {
      invitationFindFirst.mockResolvedValue(pendingInvitation());
      invitationUpdateMany.mockResolvedValue({ count: 1 });
      invitationFindUnique.mockResolvedValue(
        pendingInvitation({ status: 'accepted' }),
      );
      addParticipant.mockRejectedValue(new NotFoundException('Room not found'));

      await expect(
        service.updateRoomInvitation(viewer, 7, 5, 'accepted'),
      ).rejects.toThrow(NotFoundException);

      expect(clearRoomInvitation).not.toHaveBeenCalled();
      expect(notifyRoomInvitationAccepted).not.toHaveBeenCalled();
    });

    it('rejecting clears the invitation notification without joining the room', async () => {
      invitationFindFirst.mockResolvedValue(pendingInvitation());
      invitationUpdateMany.mockResolvedValue({ count: 1 });
      invitationFindUnique.mockResolvedValue(
        pendingInvitation({ status: 'rejected' }),
      );

      await service.updateRoomInvitation(viewer, 7, 5, 'rejected');

      expect(addParticipant).not.toHaveBeenCalled();
      expect(clearRoomInvitation).toHaveBeenCalledWith(5, 9);
      expect(notifyRoomInvitationAccepted).not.toHaveBeenCalled();
    });

    it('is an idempotent no-op once the invitee has already responded', async () => {
      const already = pendingInvitation({ status: 'accepted' });
      invitationFindFirst.mockResolvedValue(already);

      const result = await service.updateRoomInvitation(
        viewer,
        7,
        5,
        'accepted',
      );

      expect(transaction).not.toHaveBeenCalled();
      expect(addParticipant).not.toHaveBeenCalled();
      expect(result).toBe(already);
    });

    it('does nothing on a lost double-tap race (updateMany matched no row)', async () => {
      invitationFindFirst.mockResolvedValue(pendingInvitation());
      invitationUpdateMany.mockResolvedValue({ count: 0 });
      const stillPending = pendingInvitation();
      invitationFindUnique.mockResolvedValue(stillPending);

      const result = await service.updateRoomInvitation(
        viewer,
        7,
        5,
        'accepted',
      );

      expect(addParticipant).not.toHaveBeenCalled();
      expect(clearRoomInvitation).not.toHaveBeenCalled();
      expect(result).toBe(stillPending);
    });

    it('throws not-found when the invitee has no live invitation for the room', async () => {
      invitationFindFirst.mockResolvedValue(null);

      await expect(
        service.updateRoomInvitation(viewer, 7, 5, 'accepted'),
      ).rejects.toThrow(NotFoundException);
      expect(transaction).not.toHaveBeenCalled();
    });
  });

  // Regression: the room used to be fetched without `roomMembers`, so CASL
  // evaluated the public-room branch of `roomInviteConditions` against an
  // undefined relation and refused every invite into a public room — even
  // from its owner. Only the private+owner branch (scalar columns) worked,
  // which is why a private-room test suite never caught it.
  describe('createRoomInvitation — public room', () => {
    const owner = { id: 9, role: 'user' } as User;
    const publicRoom = {
      id: 7,
      name: 'Pear room',
      deletedAt: null,
      status: 'active',
      visibility: 'public',
      createdById: 9,
      roomMembers: [{ userId: 9, deletedAt: null }],
    };

    it('lets an active member invite, and loads their membership to prove it', async () => {
      roomFindFirst
        .mockResolvedValueOnce(publicRoom)
        .mockResolvedValueOnce(null);
      userFindFirst.mockResolvedValue({ id: 5 });
      invitationFindUnique.mockResolvedValue(null);
      invitationUpsert.mockResolvedValue(pendingInvitation({ inviterId: 9 }));

      await service.createRoomInvitation(owner, 7, 5, {});

      const [roomArgs] = roomFindFirst.mock.calls[0] as [
        { include?: { roomMembers?: unknown } },
      ];
      expect(roomArgs.include?.roomMembers).toEqual({
        where: { userId: 9, deletedAt: null },
      });
      expect(notifyRoomInvitation).toHaveBeenCalledWith(5, 9, 'Pear room');
    });

    it('refuses an invite from someone who is not a member of the public room', async () => {
      roomFindFirst.mockResolvedValueOnce({ ...publicRoom, roomMembers: [] });

      await expect(
        service.createRoomInvitation(
          { id: 42, role: 'user' } as User,
          7,
          5,
          {},
        ),
      ).rejects.toThrow();
      expect(invitationUpsert).not.toHaveBeenCalled();
    });
  });

  describe('createRoomInvitation — re-inviting after a leave/kick', () => {
    const inviter = { id: 9, role: 'user' } as User;
    const privateRoom = {
      id: 7,
      name: 'Pear room',
      deletedAt: null,
      status: 'active',
      visibility: 'private',
      createdById: 9,
    };

    function arrangeInvite(existing: Record<string, unknown> | null) {
      // 1st room.findFirst = the room; 2nd = the "invitee already a member?" probe
      roomFindFirst
        .mockResolvedValueOnce(privateRoom)
        .mockResolvedValueOnce(null);
      userFindFirst.mockResolvedValue({ id: 5 });
      invitationFindUnique.mockResolvedValue(existing);
    }

    it('revives a revoked invitation to pending and fires the notification', async () => {
      // state left behind by removeParticipant: accepted row, soft-deleted
      arrangeInvite({
        id: 1,
        roomId: 7,
        inviteeId: 5,
        inviterId: 9,
        status: 'accepted',
        deletedAt: new Date(),
      });
      invitationUpsert.mockResolvedValue(
        pendingInvitation({ inviterId: 9, message: 'come back' }),
      );

      await service.createRoomInvitation(inviter, 7, 5, {
        message: 'come back',
      });

      const [upsertArgs] = invitationUpsert.mock.calls[0] as [
        { update: Record<string, unknown> },
      ];
      expect(upsertArgs.update).toMatchObject({
        status: 'pending',
        deletedAt: null,
        inviterId: 9,
        message: 'come back',
      });
      expect(notifyRoomInvitation).toHaveBeenCalledWith(5, 9, 'Pear room');
    });

    it('is a silent no-op when a live pending invitation already exists', async () => {
      arrangeInvite({
        id: 1,
        roomId: 7,
        inviteeId: 5,
        inviterId: 9,
        status: 'pending',
        deletedAt: null,
        invitee: { id: 5 },
        inviter: { id: 9 },
        room: { id: 7, name: 'Pear room' },
      });

      await service.createRoomInvitation(inviter, 7, 5, {});

      expect(invitationUpsert).not.toHaveBeenCalled();
      expect(notifyRoomInvitation).not.toHaveBeenCalled();
    });

    it('refuses to invite someone who is currently an active member', async () => {
      roomFindFirst
        .mockResolvedValueOnce(privateRoom)
        .mockResolvedValueOnce({ id: 7 }); // the member probe matches
      userFindFirst.mockResolvedValue({ id: 5 });

      await expect(
        service.createRoomInvitation(inviter, 7, 5, {}),
      ).rejects.toThrow();
      expect(invitationUpsert).not.toHaveBeenCalled();
      expect(notifyRoomInvitation).not.toHaveBeenCalled();
    });
  });
});
