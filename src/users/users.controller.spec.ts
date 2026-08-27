import { type Response } from 'express';
import type { User } from 'src/generated/prisma/client';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FriendshipService } from 'src/friendship/friendship.service';
import { BlockService } from 'src/block/block.service';
import { BanService } from 'src/ban/ban.service';

function mockResponse() {
  const status = jest.fn();
  return { res: { status } as unknown as Response, status };
}

describe('UsersController', () => {
  const viewer = { id: 1, role: 'user' } as User;

  let controller: UsersController;
  let usersService: jest.Mocked<Pick<UsersService, 'findOne'>>;
  let friendshipService: jest.Mocked<
    Pick<
      FriendshipService,
      | 'getFriendshipWith'
      | 'getFriends'
      | 'createFriendRequest'
      | 'updateFriendRequest'
      | 'removeFriendship'
    >
  >;

  beforeEach(() => {
    usersService = {
      findOne: jest.fn(),
    };
    friendshipService = {
      getFriendshipWith: jest.fn(),
      getFriends: jest.fn(),
      createFriendRequest: jest.fn(),
      updateFriendRequest: jest.fn(),
      removeFriendship: jest.fn(),
    };
    controller = new UsersController(
      usersService as unknown as UsersService,
      friendshipService as unknown as FriendshipService,
      {} as unknown as BlockService,
      {} as unknown as BanService,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findOne delegates to usersService.findOne with the target id and the viewer', () => {
    void controller.findOne(2, viewer);

    expect(usersService.findOne).toHaveBeenCalledWith(2, viewer);
  });

  it('getFriendship delegates with (viewer, target)', () => {
    const { res } = mockResponse();
    void controller.getFriendship(viewer, 2, res);

    expect(friendshipService.getFriendshipWith).toHaveBeenCalledWith(viewer, 2);
  });

  it('getFriendship returns 204 with no body when there is no friendship', async () => {
    friendshipService.getFriendshipWith.mockResolvedValue(null);
    const { res, status } = mockResponse();

    const result = await controller.getFriendship(viewer, 2, res);

    expect(status).toHaveBeenCalledWith(204);
    expect(result).toBeUndefined();
  });

  it('getFriendship returns the friendship without touching the status when found', async () => {
    const friendship = {
      id: 10,
      status: 'accepted' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      userAId: 1,
      userBId: 2,
      addresseeId: 2,
      requesterId: 1,
    };
    friendshipService.getFriendshipWith.mockResolvedValue(friendship);
    const { res, status } = mockResponse();

    const result = await controller.getFriendship(viewer, 2, res);

    expect(status).not.toHaveBeenCalled();
    expect(result).toEqual(friendship);
  });

  it('getFriends delegates with (viewer, target)', () => {
    void controller.getFriends(viewer, 2);

    expect(friendshipService.getFriends).toHaveBeenCalledWith(viewer, 2);
  });

  it('createFriendRequest delegates with (viewer, target)', () => {
    void controller.createFriendRequest(1, 2);

    expect(friendshipService.createFriendRequest).toHaveBeenCalledWith(1, 2);
  });

  it('updateFriendRequest delegates with (viewer, target, status)', () => {
    void controller.updateFriendRequest(viewer, 2, { status: 'accepted' });

    expect(friendshipService.updateFriendRequest).toHaveBeenCalledWith(
      viewer,
      2,
      'accepted',
    );
  });

  it('removeFriendship delegates with (viewer, target)', () => {
    void controller.removeFriendship(viewer, 2);

    expect(friendshipService.removeFriendship).toHaveBeenCalledWith(viewer, 2);
  });
});
