import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { NotificationService } from 'src/notification/notification.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RoomsService } from 'src/rooms/rooms.service';
import { InvitationService } from './invitation.service';

describe('InvitationService', () => {
  const roomFindFirst = jest.fn();
  const userFindFirst = jest.fn();
  const invitationFindUnique = jest.fn();
  const invitationUpsert = jest.fn();
  const invitationUpdate = jest.fn();
  const prisma = {
    room: { findFirst: roomFindFirst },
    user: { findFirst: userFindFirst },
    invitation: {
      findUnique: invitationFindUnique,
      upsert: invitationUpsert,
      update: invitationUpdate,
    },
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

  beforeEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
