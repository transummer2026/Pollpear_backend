import {
  RoomCreateDTO,
  RoomUpdateDTO,
} from 'Pollpear_shared/src/schemas/rooms.schema';
import type { InvitationCreateDTO } from 'Pollpear_shared/src/schemas/invitations.schema';
import { Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { User } from 'src/generated/prisma/client';
import { MessagesService } from 'src/messages/messages.service';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { InvitationService } from 'src/invitation/invitation.service';

function mockResponse() {
  const status = jest.fn();
  return { res: { status } as unknown as Response, status };
}

const viewer = { id: 42, role: 'user' } as User;

describe('RoomsController', () => {
  let controller: RoomsController;
  let messages: jest.Mocked<Pick<MessagesService, 'listForRoom'>>;
  let service: jest.Mocked<
    Pick<
      RoomsService,
      'findOneRoom' | 'create' | 'update' | 'remove' | 'removeMessage'
    >
  >;
  let invitationService: jest.Mocked<
    Pick<
      InvitationService,
      | 'getRoomInvitation'
      | 'getRoomInvitations'
      | 'createRoomInvitation'
      | 'updateRoomInvitation'
      | 'removeInvitation'
    >
  >;

  beforeEach(() => {
    service = {
      findOneRoom: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      removeMessage: jest.fn(),
    };
    messages = { listForRoom: jest.fn() };
    invitationService = {
      getRoomInvitation: jest.fn(),
      getRoomInvitations: jest.fn(),
      createRoomInvitation: jest.fn(),
      updateRoomInvitation: jest.fn(),
      removeInvitation: jest.fn(),
    };
    controller = new RoomsController(
      service as unknown as RoomsService,
      messages as unknown as MessagesService,
      invitationService as unknown as InvitationService,
      {} as Logger,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET :id delegates to roomsService.findOneRoom with (id, viewer)', async () => {
    await controller.findOneRoom(7, viewer);

    expect(service.findOneRoom).toHaveBeenCalledWith(7, viewer);
  });

  it('POST new delegates to roomsService.create with (viewer, body)', async () => {
    const body: RoomCreateDTO = {
      name: 'Best pear variety?',
      visibility: 'public',
    };

    await controller.create(viewer, body);

    expect(service.create).toHaveBeenCalledWith(viewer, body);
  });

  it('PATCH :id delegates to roomsService.update with (id, viewer, body)', async () => {
    const body: RoomUpdateDTO = { name: 'Renamed' };

    await controller.update(7, viewer, body);

    expect(service.update).toHaveBeenCalledWith(7, viewer, body);
  });

  it('DELETE :id delegates to roomsService.remove with (id, viewer)', async () => {
    await controller.remove(7, viewer);

    expect(service.remove).toHaveBeenCalledWith(7, viewer);
  });

  it('GET :id/invitations delegates to invitationService.getRoomInvitations with (viewer, id)', async () => {
    await controller.getRoomInvitations(viewer, 7);

    expect(invitationService.getRoomInvitations).toHaveBeenCalledWith(
      viewer,
      7,
    );
  });

  it('GET :id/invitations/:userId returns 204 with no body when there is no invitation', async () => {
    invitationService.getRoomInvitation.mockResolvedValue(null);
    const { res, status } = mockResponse();

    const result = await controller.getRoomInvitation(viewer, 7, 42, res);

    expect(invitationService.getRoomInvitation).toHaveBeenCalledWith(
      viewer,
      7,
      42,
    );
    expect(status).toHaveBeenCalledWith(204);
    expect(result).toBeUndefined();
  });

  it('GET :id/invitations/:userId returns the invitation without touching the status when found', async () => {
    const invitation = { id: 1, status: 'pending' } as never;
    invitationService.getRoomInvitation.mockResolvedValue(invitation);
    const { res, status } = mockResponse();

    const result = await controller.getRoomInvitation(viewer, 7, 42, res);

    expect(status).not.toHaveBeenCalled();
    expect(result).toEqual(invitation);
  });

  it('POST :id/invitations/:userId delegates to invitationService.createRoomInvitation with (viewer, id, userId, body)', async () => {
    const body: InvitationCreateDTO = {};

    await controller.createInvitation(viewer, 7, 42, body);

    expect(invitationService.createRoomInvitation).toHaveBeenCalledWith(
      viewer,
      7,
      42,
      body,
    );
  });

  it('PATCH :id/invitations/:userId delegates to invitationService.respondToInvitation with (viewer, id, userId, status)', async () => {
    await controller.respondToInvitation(viewer, 7, 42, {
      status: 'accepted',
    });

    expect(invitationService.updateRoomInvitation).toHaveBeenCalledWith(
      viewer,
      7,
      42,
      'accepted',
    );
  });

  it('DELETE :id/invitations/:userId delegates to invitationService.removeInvitation with (viewer, id, userId)', async () => {
    await controller.removeInvitation(viewer, 7, 42);

    expect(invitationService.removeInvitation).toHaveBeenCalledWith(
      viewer,
      7,
      42,
    );
  });

  it('GET :id/messages delegates to messagesService.listForRoom with (id, viewer, query)', async () => {
    const query = { limit: 50 };

    await controller.getMessages(7, viewer, query);

    expect(messages.listForRoom).toHaveBeenCalledWith(7, viewer, query);
  });

  it('DELETE :id/messages/:messageId delegates to roomsService.removeMessage with (id, messageId)', () => {
    controller.removeMessage(7, 99);

    expect(service.removeMessage).toHaveBeenCalledWith(7, 99);
  });
});
