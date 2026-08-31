import { Test, TestingModule } from '@nestjs/testing';
import { ApiFriendshipsController } from './friendships.controller';
import { ApiFriendshipsService } from './friendships.service';
import type { User } from 'src/generated/prisma/client';

const caller = { id: 4, role: 'user' } as unknown as User;

describe('ApiFriendshipsController', () => {
  let controller: ApiFriendshipsController;
  const findAllFriendships = jest.fn();
  const findOneFriendship = jest.fn();
  const createFriendship = jest.fn();
  const updateFriendship = jest.fn();
  const removeFriendship = jest.fn();

  beforeEach(async () => {
    [
      findAllFriendships,
      findOneFriendship,
      createFriendship,
      updateFriendship,
      removeFriendship,
    ].forEach((fn) => fn.mockReset());

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiFriendshipsController],
      providers: [
        {
          provide: ApiFriendshipsService,
          useValue: {
            findAllFriendships,
            findOneFriendship,
            createFriendship,
            updateFriendship,
            removeFriendship,
          },
        },
      ],
    }).compile();

    controller = module.get<ApiFriendshipsController>(ApiFriendshipsController);
  });

  it('forwards the paging query and the caller', () => {
    void controller.findAllFriendships({ page: 1, limit: 20 }, caller);

    expect(findAllFriendships).toHaveBeenCalledWith(
      { page: 1, limit: 20 },
      caller,
    );
  });

  it('never lets the body decide who is asking', () => {
    void controller.createFriendship({ addresseeId: 9 }, caller);

    expect(createFriendship).toHaveBeenCalledWith({ addresseeId: 9 }, caller);
  });

  it('passes the id and the caller along on every single-friendship route', () => {
    void controller.findOneFriendship(1, caller);
    void controller.updateFriendship(1, { status: 'accepted' }, caller);
    void controller.removeFriendship(1, caller);

    expect(findOneFriendship).toHaveBeenCalledWith(1, caller);
    expect(updateFriendship).toHaveBeenCalledWith(
      1,
      { status: 'accepted' },
      caller,
    );
    expect(removeFriendship).toHaveBeenCalledWith(1, caller);
  });
});
