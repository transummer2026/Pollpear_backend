import {
  RoomCreateDTO,
  RoomUpdateDTO,
} from 'Pollpear_shared/src/schemas/rooms.schema';
import { Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { User } from 'src/generated/prisma/client';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

const viewer = { id: 42, role: 'user' } as User;

describe('RoomsController', () => {
  let controller: RoomsController;
  let service: jest.Mocked<
    Pick<
      RoomsService,
      | 'findOneRoom'
      | 'create'
      | 'update'
      | 'remove'
      | 'addParticipant'
      | 'removeParticipant'
      | 'getMessages'
      | 'createMessage'
      | 'removeMessage'
    >
  >;

  beforeEach(() => {
    service = {
      findOneRoom: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      addParticipant: jest.fn(),
      removeParticipant: jest.fn(),
      getMessages: jest.fn(),
      createMessage: jest.fn(),
      removeMessage: jest.fn(),
    };
    controller = new RoomsController(
      service as unknown as RoomsService,
      {} as PrismaService,
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

  it('POST :id/participants/:userId delegates to roomsService.addParticipant with (id, userId)', () => {
    controller.addParticipant(7, 42);

    expect(service.addParticipant).toHaveBeenCalledWith(7, 42);
  });

  it('DELETE :id/participants/:userId delegates to roomsService.removeParticipant with (id, userId)', () => {
    controller.removeParticipant(7, 42);

    expect(service.removeParticipant).toHaveBeenCalledWith(7, 42);
  });

  it('GET :id/messages delegates to roomsService.getMessages with (id)', () => {
    controller.getMessages(7);

    expect(service.getMessages).toHaveBeenCalledWith(7);
  });

  it('POST :id/messages delegates to roomsService.createMessage with (id)', () => {
    controller.createMessage(7);

    expect(service.createMessage).toHaveBeenCalledWith(7);
  });

  it('DELETE :id/messages/:messageId delegates to roomsService.removeMessage with (id, messageId)', () => {
    controller.removeMessage(7, 99);

    expect(service.removeMessage).toHaveBeenCalledWith(7, 99);
  });
});
