import { type Response } from 'express';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

function mockResponse() {
  const status = jest.fn();
  return { res: { status } as unknown as Response, status };
}

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<
    Pick<
      UsersService,
      | 'findOne'
      | 'getFriendshipWith'
      | 'getFriends'
      | 'createFriendRequest'
      | 'updateFriendRequest'
      | 'removeFriendship'
    >
  >;

  beforeEach(() => {
    service = {
      findOne: jest.fn(),
      getFriendshipWith: jest.fn(),
      getFriends: jest.fn(),
      createFriendRequest: jest.fn(),
      updateFriendRequest: jest.fn(),
      removeFriendship: jest.fn(),
    };
    controller = new UsersController(service as unknown as UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findOne delegates to usersService.findOne with the target id', () => {
    void controller.findOne(2);

    expect(service.findOne).toHaveBeenCalledWith(2);
  });

  it('getFriendship delegates with (viewer, target)', () => {
    const { res } = mockResponse();
    void controller.getFriendship(1, 2, res);

    expect(service.getFriendshipWith).toHaveBeenCalledWith(1, 2);
  });

  it('getFriendship returns 204 with no body when there is no friendship', async () => {
    service.getFriendshipWith.mockResolvedValue(null);
    const { res, status } = mockResponse();

    const result = await controller.getFriendship(1, 2, res);

    expect(status).toHaveBeenCalledWith(204);
    expect(result).toBeUndefined();
  });

  it('getFriendship returns the friendship without touching the status when found', async () => {
    const friendship = {
      id: 10,
      status: 'accepted' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      requesterId: 1,
      addresseeId: 2,
    };
    service.getFriendshipWith.mockResolvedValue(friendship);
    const { res, status } = mockResponse();

    const result = await controller.getFriendship(1, 2, res);

    expect(status).not.toHaveBeenCalled();
    expect(result).toEqual(friendship);
  });

  it('getFriends delegates with the target id only', () => {
    void controller.getFriends(2);

    expect(service.getFriends).toHaveBeenCalledWith(2);
  });

  it('createFriendRequest delegates with (viewer, target)', () => {
    void controller.createFriendRequest(1, 2);

    expect(service.createFriendRequest).toHaveBeenCalledWith(1, 2);
  });

  it('updateFriendRequest delegates with (viewer, target, status)', () => {
    void controller.updateFriendRequest(1, 2, { status: 'accepted' });

    expect(service.updateFriendRequest).toHaveBeenCalledWith(1, 2, 'accepted');
  });

  it('removeFriendship delegates with (viewer, target)', () => {
    void controller.removeFriendship(1, 2);

    expect(service.removeFriendship).toHaveBeenCalledWith(1, 2);
  });
});
