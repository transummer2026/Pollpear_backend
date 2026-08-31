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
});
