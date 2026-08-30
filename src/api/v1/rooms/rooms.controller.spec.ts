import { Test, TestingModule } from '@nestjs/testing';
import { ApiRoomsController } from './rooms.controller';
import { ApiRoomsService } from './rooms.service';
import type { User } from 'src/generated/prisma/client';

const caller = { id: 7, role: 'user' } as unknown as User;

describe('ApiRoomsController', () => {
  let controller: ApiRoomsController;
  const findAllRooms = jest.fn();
  const findOneRoom = jest.fn();
  const createRoom = jest.fn();
  const updateRoom = jest.fn();
  const removeRoom = jest.fn();

  beforeEach(async () => {
    [findAllRooms, findOneRoom, createRoom, updateRoom, removeRoom].forEach(
      (fn) => fn.mockReset(),
    );
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiRoomsController],
      providers: [
        {
          provide: ApiRoomsService,
          useValue: {
            findAllRooms,
            findOneRoom,
            createRoom,
            updateRoom,
            removeRoom,
          },
        },
      ],
    }).compile();

    controller = module.get<ApiRoomsController>(ApiRoomsController);
  });

  it('forwards the paging query and the caller', () => {
    void controller.findAllRooms({ page: 1, limit: 20 }, caller);

    expect(findAllRooms).toHaveBeenCalledWith({ page: 1, limit: 20 }, caller);
  });

  it('never lets the body decide who the owner is', () => {
    const body = { name: 'Fruit lovers', visibility: 'public' as const };

    void controller.createRoom(body, caller);

    expect(createRoom).toHaveBeenCalledWith(body, caller);
  });

  it('passes the id and the caller along on every single-room route', () => {
    void controller.findOneRoom(42, caller);
    void controller.updateRoom(42, { name: 'Renamed' }, caller);
    void controller.removeRoom(42, caller);

    expect(findOneRoom).toHaveBeenCalledWith(42, caller);
    expect(updateRoom).toHaveBeenCalledWith(42, { name: 'Renamed' }, caller);
    expect(removeRoom).toHaveBeenCalledWith(42, caller);
  });
});
