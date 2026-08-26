import {
  RoomCreateDTO,
  RoomUpdateDTO,
} from 'Pollpear_shared/src/schemas/rooms.schema';
import { PrismaService } from 'src/prisma/prisma.service';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

describe('RoomsController', () => {
  let controller: RoomsController;
  let service: jest.Mocked<
    Pick<
      RoomsService,
      | 'findMeOneRoom'
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
      findMeOneRoom: jest.fn(),
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
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET :id delegates to roomsService.findMeOneRoom with (id, userId)', async () => {
    await controller.findMeOneRoom(7, 42);

    expect(service.findMeOneRoom).toHaveBeenCalledWith(7, 42);
  });

  it('POST new delegates to roomsService.create with (userId, body)', async () => {
    const body: RoomCreateDTO = {
      name: 'Best pear variety?',
      visibility: 'public',
    };

    await controller.create(42, body);

    expect(service.create).toHaveBeenCalledWith(42, body);
  });

  it('PATCH :id delegates to roomsService.update with (id, userId, body)', async () => {
    const body: RoomUpdateDTO = { name: 'Renamed' };

    await controller.update(7, 42, body);

    expect(service.update).toHaveBeenCalledWith(7, 42, body);
  });

  it('DELETE :id delegates to roomsService.remove with (id, userId)', async () => {
    await controller.remove(7, 42);

    expect(service.remove).toHaveBeenCalledWith(7, 42);
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
