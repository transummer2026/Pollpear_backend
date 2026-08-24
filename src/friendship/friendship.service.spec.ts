import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ForbiddenError } from '@casl/ability';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { NotificationService } from 'src/notification/notification.service';
import { Prisma } from 'src/generated/prisma/client';
import { FriendshipService } from './friendship.service';

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    username: 'alice',
    role: 'user',
    ...overrides,
  };
}

function makeFriendship(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 10,
    status: 'pending',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    requesterId: 1,
    addresseeId: 2,
    ...overrides,
  };
}

function makeBlock(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 20,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    blockerId: 1,
    blockedId: 2,
    ...overrides,
  };
}

type FindFirstArgs = { where: Record<string, unknown> };
type FindManyArgs = {
  where: Record<string, unknown>;
  include?: Record<string, unknown>;
};
type UpsertArgs = {
  where: Record<string, unknown>;
  create: Record<string, unknown>;
  update: Record<string, unknown>;
};
type UpdateArgs = { where: { id: number }; data: Record<string, unknown> };

describe('FriendshipService', () => {
  let service: FriendshipService;
  let notifications: {
    notify: jest.Mock;
    clearFriendRequest: jest.Mock;
  };
  let prisma: {
    user: {
      findUniqueOrThrow: jest.Mock<Promise<unknown>, [FindFirstArgs]>;
      findUnique: jest.Mock<Promise<unknown>, [FindFirstArgs]>;
    };
    friendship: {
      findFirst: jest.Mock<Promise<unknown>, [FindFirstArgs]>;
      findUnique: jest.Mock<Promise<unknown>, [FindFirstArgs]>;
      findMany: jest.Mock<Promise<unknown[]>, [FindManyArgs]>;
      upsert: jest.Mock<Promise<unknown>, [UpsertArgs]>;
      update: jest.Mock<Promise<unknown>, [UpdateArgs]>;
      create: jest.Mock<Promise<unknown>, [{ data: Record<string, unknown> }]>;
    };
    block: {
      findFirst: jest.Mock<Promise<unknown>, [FindFirstArgs]>;
    };
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUniqueOrThrow: jest
          .fn<Promise<unknown>, [FindFirstArgs]>()
          .mockResolvedValue(makeUser({ id: 1 })),
        findUnique: jest
          .fn<Promise<unknown>, [FindFirstArgs]>()
          .mockResolvedValue(makeUser({ id: 1 })),
      },
      friendship: {
        findFirst: jest.fn<Promise<unknown>, [FindFirstArgs]>(),
        findUnique: jest.fn<Promise<unknown>, [FindFirstArgs]>(),
        findMany: jest.fn<Promise<unknown[]>, [FindManyArgs]>(),
        upsert: jest.fn<Promise<unknown>, [UpsertArgs]>(),
        update: jest.fn<Promise<unknown>, [UpdateArgs]>(),
        create: jest.fn<
          Promise<unknown>,
          [{ data: Record<string, unknown> }]
        >(),
      },
      block: {
        findFirst: jest.fn<Promise<unknown>, [FindFirstArgs]>(),
      },
    };
    notifications = { notify: jest.fn(), clearFriendRequest: jest.fn() };
    service = new FriendshipService(
      prisma as unknown as PrismaService,
      new CaslAbilityFactory(),
      notifications as unknown as NotificationService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getFriendshipWith', () => {
    it('returns null when no friendship exists between the two users', async () => {
      prisma.friendship.findFirst.mockResolvedValue(null);

      const result = await service.getFriendshipWith(1, 2);

      expect(prisma.friendship.findFirst).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          OR: [
            { requesterId: 1, addresseeId: 2 },
            { requesterId: 2, addresseeId: 1 },
          ],
        },
      });
      expect(result).toBeNull();
    });

    it('returns the friendship without deletedAt when found', async () => {
      prisma.friendship.findFirst.mockResolvedValue(makeFriendship());

      const result = await service.getFriendshipWith(1, 2);

      expect(result).not.toHaveProperty('deletedAt');
      expect(result?.status).toBe('pending');
    });
  });

  describe('getFriends', () => {
    it('maps each friendship to the other user, whichever side the viewer is on', async () => {
      const friendAsAddressee = {
        id: 2,
        username: 'friend-2',
        avatarUrl: '/uploads/avatars/default.svg',
        isOnline: false,
      };
      const friendAsRequester = {
        id: 3,
        username: 'friend-3',
        avatarUrl: '/uploads/avatars/default.svg',
        isOnline: false,
      };
      prisma.friendship.findMany.mockResolvedValue([
        makeFriendship({
          id: 10,
          status: 'accepted',
          requesterId: 1,
          addresseeId: 2,
          requester: {
            id: 1,
            username: 'alice',
            avatarUrl: '/uploads/avatars/default.svg',
            isOnline: false,
          },
          addressee: friendAsAddressee,
        }),
        makeFriendship({
          id: 11,
          status: 'accepted',
          requesterId: 3,
          addresseeId: 1,
          requester: friendAsRequester,
          addressee: {
            id: 1,
            username: 'alice',
            avatarUrl: '/uploads/avatars/default.svg',
            isOnline: false,
          },
        }),
      ]);

      const result = await service.getFriends(1, 1);

      const friendUserSelect = {
        id: true,
        username: true,
        avatarUrl: true,
        isOnline: true,
      };
      expect(prisma.friendship.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          status: 'accepted',
          OR: [{ requesterId: 1 }, { addresseeId: 1 }],
        },
        include: {
          requester: { select: friendUserSelect },
          addressee: { select: friendUserSelect },
        },
      });
      expect(result).toEqual([
        {
          friendshipId: 10,
          status: 'accepted',
          createdAt: new Date('2024-01-01'),
          user: friendAsAddressee,
        },
        {
          friendshipId: 11,
          status: 'accepted',
          createdAt: new Date('2024-01-01'),
          user: friendAsRequester,
        },
      ]);
    });

    it("excludes the viewer from another user's friend list", async () => {
      prisma.friendship.findMany.mockResolvedValue([]);

      await service.getFriends(1, 2);

      expect(prisma.friendship.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deletedAt: null,
            status: 'accepted',
            OR: [{ requesterId: 2 }, { addresseeId: 2 }],
            NOT: [{ requesterId: 1 }, { addresseeId: 1 }],
          },
        }),
      );
    });

    it('does not filter anyone out of your own friend list', async () => {
      prisma.friendship.findMany.mockResolvedValue([]);

      await service.getFriends(1, 1);

      const [args] = prisma.friendship.findMany.mock.calls[0];
      expect(args.where).not.toHaveProperty('NOT');
    });
  });

  describe('getFriendRequests', () => {
    it("rejects viewing another user's pending requests", async () => {
      await expect(service.getFriendRequests(1, 2)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      expect(prisma.friendship.findMany).not.toHaveBeenCalled();
    });

    it('returns pending requests received by the caller, mapped to the requester', async () => {
      const requester = {
        id: 2,
        username: 'friend-2',
        avatarUrl: '/uploads/avatars/default.svg',
        isOnline: false,
      };
      prisma.friendship.findMany.mockResolvedValue([
        makeFriendship({
          id: 10,
          status: 'pending',
          requesterId: 2,
          addresseeId: 1,
          requester,
        }),
      ]);

      const result = await service.getFriendRequests(1, 1);

      expect(prisma.friendship.findMany).toHaveBeenCalledWith({
        where: { addresseeId: 1, status: 'pending', deletedAt: null },
        include: {
          requester: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              isOnline: true,
            },
          },
        },
      });
      expect(result).toEqual([
        {
          friendshipId: 10,
          status: 'pending',
          createdAt: new Date('2024-01-01'),
          user: requester,
        },
      ]);
    });
  });

  describe('createFriendRequest', () => {
    function uniqueViolation() {
      return new Prisma.PrismaClientKnownRequestError('raw database detail', {
        code: 'P2002',
        clientVersion: '7.8.0',
      });
    }

    it('rejects sending a friend request to yourself', async () => {
      await expect(service.createFriendRequest(1, 1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.friendship.findMany).not.toHaveBeenCalled();
      expect(prisma.friendship.create).not.toHaveBeenCalled();
    });

    it('rejects when a block exists between the two users, in either direction', async () => {
      prisma.block.findFirst.mockResolvedValue(makeBlock());

      await expect(service.createFriendRequest(1, 2)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.friendship.findMany).not.toHaveBeenCalled();
      expect(prisma.friendship.create).not.toHaveBeenCalled();
    });

    it('rejects when an accepted friendship already exists', async () => {
      prisma.friendship.findMany.mockResolvedValue([
        makeFriendship({ status: 'accepted' }),
      ]);

      await expect(service.createFriendRequest(1, 2)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.friendship.create).not.toHaveBeenCalled();
    });

    it('prefers an accepted row over another active row when both exist', async () => {
      prisma.friendship.findMany.mockResolvedValue([
        makeFriendship({ id: 11, status: 'rejected', requesterId: 2 }),
        makeFriendship({ id: 10, status: 'accepted' }),
      ]);

      await expect(service.createFriendRequest(1, 2)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.friendship.update).not.toHaveBeenCalled();
    });

    it('returns the pending request unchanged when the caller already sent it', async () => {
      const pending = makeFriendship({ status: 'pending' });
      prisma.friendship.findMany.mockResolvedValue([pending]);

      const result = await service.createFriendRequest(1, 2);

      expect(result.status).toBe('pending');
      expect(prisma.friendship.create).not.toHaveBeenCalled();
      expect(prisma.friendship.update).not.toHaveBeenCalled();
      expect(notifications.notify).not.toHaveBeenCalled();
    });

    it('accepts directly when the target already sent a pending request', async () => {
      const incoming = makeFriendship({
        id: 10,
        status: 'pending',
        requesterId: 2,
        addresseeId: 1,
      });
      prisma.friendship.findMany.mockResolvedValue([incoming]);
      prisma.friendship.update.mockResolvedValue({
        ...incoming,
        status: 'accepted',
      });

      const result = await service.createFriendRequest(1, 2);

      expect(prisma.friendship.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { status: 'accepted' },
      });
      expect(notifications.clearFriendRequest).toHaveBeenCalledWith(1, 2);
      expect(notifications.notify).toHaveBeenCalledWith(
        2,
        'friend_accepted',
        'alice accepted your friend request.',
        1,
      );
      expect(result.status).toBe('accepted');
    });

    it('creates a fresh request and notifies the addressee when no relation exists', async () => {
      const created = makeFriendship({ status: 'pending' });
      prisma.friendship.findMany.mockResolvedValue([]);
      prisma.friendship.create.mockResolvedValue(created);
      prisma.friendship.findUnique.mockResolvedValue(created);

      const result = await service.createFriendRequest(1, 2);

      expect(prisma.friendship.create).toHaveBeenCalledWith({
        data: { requesterId: 1, addresseeId: 2, status: 'pending' },
      });
      expect(notifications.notify).toHaveBeenCalledWith(
        2,
        'friend_request',
        'alice sent you a friend request.',
        1,
      );
      expect(result.status).toBe('pending');
    });

    it('revives the same-direction row and refreshes its creation date', async () => {
      const soft = makeFriendship({
        id: 10,
        status: 'rejected',
        deletedAt: new Date('2024-02-01'),
      });
      const revived = makeFriendship({ id: 10, status: 'pending' });
      prisma.friendship.findMany.mockResolvedValue([soft]);
      prisma.friendship.update.mockResolvedValue(revived);
      prisma.friendship.findUnique.mockResolvedValue(revived);

      await service.createFriendRequest(1, 2);

      expect(prisma.friendship.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: {
          status: 'pending',
          deletedAt: null,
          createdAt: expect.any(Date) as Date,
        },
      });
      expect(prisma.friendship.create).not.toHaveBeenCalled();
    });

    it('soft-deletes an active reverse-direction row before creating its own', async () => {
      const reverse = makeFriendship({
        id: 11,
        status: 'rejected',
        requesterId: 2,
        addresseeId: 1,
      });
      const created = makeFriendship({ id: 12, status: 'pending' });
      prisma.friendship.findMany.mockResolvedValue([reverse]);
      prisma.friendship.update.mockResolvedValue(reverse);
      prisma.friendship.create.mockResolvedValue(created);
      prisma.friendship.findUnique.mockResolvedValue(created);

      await service.createFriendRequest(1, 2);

      expect(prisma.friendship.update).toHaveBeenCalledWith({
        where: { id: 11 },
        data: { deletedAt: expect.any(Date) as Date },
      });
      expect(prisma.friendship.create).toHaveBeenCalledWith({
        data: { requesterId: 1, addresseeId: 2, status: 'pending' },
      });
    });

    it('retries the resolution once when the unique index rejects the create', async () => {
      const mirror = makeFriendship({
        id: 13,
        status: 'pending',
        requesterId: 2,
        addresseeId: 1,
      });
      prisma.friendship.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mirror]);
      prisma.friendship.create.mockRejectedValue(uniqueViolation());
      prisma.friendship.update.mockResolvedValue({
        ...mirror,
        status: 'accepted',
      });

      const result = await service.createFriendRequest(1, 2);

      expect(prisma.friendship.create).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('accepted');
      expect(notifications.notify).toHaveBeenCalledWith(
        2,
        'friend_accepted',
        'alice accepted your friend request.',
        1,
      );
    });

    it('retries the resolution once when the unique index rejects the revive', async () => {
      const soft = makeFriendship({
        id: 10,
        status: 'rejected',
        deletedAt: new Date('2024-02-01'),
      });
      const mirror = makeFriendship({
        id: 13,
        status: 'pending',
        requesterId: 2,
        addresseeId: 1,
      });
      prisma.friendship.findMany
        .mockResolvedValueOnce([soft])
        .mockResolvedValueOnce([mirror]);
      prisma.friendship.update
        .mockRejectedValueOnce(uniqueViolation())
        .mockResolvedValue({ ...mirror, status: 'accepted' });

      const result = await service.createFriendRequest(1, 2);

      expect(result.status).toBe('accepted');
    });

    it('reports the accepted state when a concurrent request accepted first', async () => {
      const created = makeFriendship({ id: 12, status: 'pending' });
      prisma.friendship.findMany.mockResolvedValue([]);
      prisma.friendship.create.mockResolvedValue(created);
      prisma.friendship.findUnique.mockResolvedValue({
        ...created,
        status: 'accepted',
      });

      const result = await service.createFriendRequest(1, 2);

      expect(result.status).toBe('accepted');
      expect(notifications.notify).not.toHaveBeenCalled();
      expect(notifications.clearFriendRequest).toHaveBeenCalledWith(2, 1);
    });

    it('propagates errors that are not unique violations', async () => {
      prisma.friendship.findMany.mockResolvedValue([]);
      prisma.friendship.create.mockRejectedValue(new Error('boom'));

      await expect(service.createFriendRequest(1, 2)).rejects.toThrow('boom');
      expect(prisma.friendship.findMany).toHaveBeenCalledTimes(1);
    });
  });
  describe('updateFriendRequest', () => {
    it('throws when there is no pending request from that user', async () => {
      prisma.friendship.findFirst.mockResolvedValue(null);

      await expect(
        service.updateFriendRequest(1, 2, 'accepted'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.friendship.update).not.toHaveBeenCalled();
    });

    it('looks up the friendship between the two users regardless of direction', async () => {
      prisma.friendship.findFirst.mockResolvedValue(null);

      await service
        .updateFriendRequest(1, 2, 'accepted')
        .catch(() => undefined);

      expect(prisma.friendship.findFirst).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          OR: [
            { requesterId: 1, addresseeId: 2 },
            { requesterId: 2, addresseeId: 1 },
          ],
        },
      });
    });

    it('rejects when the caller is the requester, not the addressee', async () => {
      const pending = makeFriendship({
        id: 10,
        status: 'pending',
        requesterId: 1,
        addresseeId: 2,
      });
      prisma.friendship.findFirst.mockResolvedValue(pending);

      await expect(
        service.updateFriendRequest(1, 2, 'accepted'),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(prisma.friendship.update).not.toHaveBeenCalled();
    });

    it('rejects when the friendship exists but is no longer pending', async () => {
      const accepted = makeFriendship({
        id: 10,
        status: 'accepted',
        requesterId: 2,
        addresseeId: 1,
      });
      prisma.friendship.findFirst.mockResolvedValue(accepted);

      await expect(
        service.updateFriendRequest(1, 2, 'rejected'),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(prisma.friendship.update).not.toHaveBeenCalled();
    });

    it('is idempotent when accepting an already accepted friendship', async () => {
      const accepted = makeFriendship({
        id: 10,
        status: 'accepted',
        requesterId: 2,
        addresseeId: 1,
      });
      prisma.friendship.findFirst.mockResolvedValue(accepted);

      const result = await service.updateFriendRequest(1, 2, 'accepted');

      expect(result.status).toBe('accepted');
      expect(prisma.friendship.update).not.toHaveBeenCalled();
      expect(notifications.clearFriendRequest).toHaveBeenCalledWith(1, 2);
    });

    it('updates the status when a pending request exists', async () => {
      const pending = makeFriendship({
        id: 10,
        status: 'pending',
        requesterId: 2,
        addresseeId: 1,
      });
      prisma.friendship.findFirst.mockResolvedValue(pending);
      prisma.friendship.update.mockResolvedValue({
        ...pending,
        status: 'accepted',
      });

      const result = await service.updateFriendRequest(1, 2, 'accepted');

      expect(prisma.friendship.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { status: 'accepted' },
      });
      expect(result.status).toBe('accepted');
    });

    it('rejects the pending request when the addressee declines', async () => {
      const pending = makeFriendship({
        id: 10,
        status: 'pending',
        requesterId: 2,
        addresseeId: 1,
      });
      prisma.friendship.findFirst.mockResolvedValue(pending);
      prisma.friendship.update.mockResolvedValue({
        ...pending,
        status: 'rejected',
      });

      const result = await service.updateFriendRequest(1, 2, 'rejected');

      expect(prisma.friendship.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { status: 'rejected' },
      });
      expect(result.status).toBe('rejected');
    });
  });

  describe('removeFriendship', () => {
    it('throws when there is no friendship between the two users', async () => {
      prisma.friendship.findFirst.mockResolvedValue(null);

      await expect(service.removeFriendship(1, 2)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.friendship.update).not.toHaveBeenCalled();
    });

    it('soft-deletes the friendship when found', async () => {
      prisma.friendship.findFirst.mockResolvedValue(makeFriendship({ id: 10 }));
      prisma.friendship.update.mockResolvedValue(undefined);

      await service.removeFriendship(1, 2);

      const [args] = prisma.friendship.update.mock.calls[0];
      expect(args.where).toEqual({ id: 10 });
      expect(args.data.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('friendIds', () => {
    it('maps each accepted friendship to the other user id', async () => {
      prisma.friendship.findMany.mockResolvedValue([
        makeFriendship({ requesterId: 1, addresseeId: 2 }),
        makeFriendship({ requesterId: 3, addresseeId: 1 }),
      ]);

      const ids = await service.friendIds(1);

      expect(prisma.friendship.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          status: 'accepted',
          OR: [{ requesterId: 1 }, { addresseeId: 1 }],
        },
        select: { requesterId: true, addresseeId: true },
      });
      expect(ids).toEqual([2, 3]);
    });
  });
});
