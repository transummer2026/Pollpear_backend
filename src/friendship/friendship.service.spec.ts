import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ForbiddenError } from '@casl/ability';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { accessibleBy } from 'src/casl/casl-prisma';
import { NotificationService } from 'src/notification/notification.service';
import { Prisma } from 'src/generated/prisma/client';
import type { User } from 'src/generated/prisma/client';
import { FriendshipService } from './friendship.service';

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    username: 'alice',
    role: 'user',
    ...overrides,
  };
}

/** A full-shaped `User` for a given id — what `@CurrentUser()` now hands
 * the service, in place of a bare id. */
function viewer(id: number): User {
  return makeUser({ id }) as User;
}

function makeFriendship(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 10,
    status: 'pending',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    userAId: 1,
    userBId: 2,
    addresseeId: 2,
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
    notifyFriendRequest: jest.Mock;
    notifyFriendAccepted: jest.Mock;
  };
  let prisma: {
    user: {
      findUniqueOrThrow: jest.Mock<Promise<unknown>, [FindFirstArgs]>;
      findUnique: jest.Mock<Promise<unknown>, [FindFirstArgs]>;
      findFirst: jest.Mock<Promise<unknown>, [FindFirstArgs]>;
    };
    friendship: {
      findFirst: jest.Mock<Promise<unknown>, [FindFirstArgs]>;
      findUnique: jest.Mock<Promise<unknown>, [FindFirstArgs]>;
      findMany: jest.Mock<Promise<unknown[]>, [FindManyArgs]>;
      upsert: jest.Mock<Promise<unknown>, [UpsertArgs]>;
      update: jest.Mock<Promise<unknown>, [UpdateArgs]>;
      create: jest.Mock<Promise<unknown>, [{ data: Record<string, unknown> }]>;
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
        findFirst: jest
          .fn<Promise<unknown>, [FindFirstArgs]>()
          .mockResolvedValue(makeUser({ id: 2 })),
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
    };
    notifications = {
      notify: jest.fn(),
      clearFriendRequest: jest.fn(),
      notifyFriendRequest: jest.fn(),
      notifyFriendAccepted: jest.fn(),
    };
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

      const result = await service.getFriendshipWith(viewer(1), 2);

      expect(prisma.friendship.findFirst).toHaveBeenCalledWith({
        where: { userAId: 1, userBId: 2, deletedAt: null },
      });
      expect(result).toBeNull();
    });

    it('returns the friendship without deletedAt when found', async () => {
      prisma.friendship.findFirst.mockResolvedValue(makeFriendship());

      const result = await service.getFriendshipWith(viewer(1), 2);

      expect(result).not.toHaveProperty('deletedAt');
      expect(result?.status).toBe('pending');
      expect(result?.requesterId).toBe(1);
    });

    it('derives requesterId from the pair when the addressee is userA', async () => {
      prisma.friendship.findFirst.mockResolvedValue(
        makeFriendship({ addresseeId: 1 }),
      );

      const result = await service.getFriendshipWith(viewer(1), 2);

      expect(result?.requesterId).toBe(2);
    });
  });

  describe('getFriends', () => {
    it('maps each friendship to the other user, whichever side the viewer is on', async () => {
      const viewerRow = {
        id: 2,
        username: 'alice',
        avatarUrl: '/uploads/avatars/default.svg',
        isOnline: false,
      };
      const friendAsUserA = {
        id: 1,
        username: 'friend-1',
        avatarUrl: '/uploads/avatars/default.svg',
        isOnline: false,
      };
      const friendAsUserB = {
        id: 3,
        username: 'friend-3',
        avatarUrl: '/uploads/avatars/default.svg',
        isOnline: false,
      };
      prisma.friendship.findMany.mockResolvedValue([
        makeFriendship({
          id: 10,
          status: 'accepted',
          userAId: 1,
          userBId: 2,
          addresseeId: 2,
          userA: friendAsUserA,
          userB: viewerRow,
        }),
        makeFriendship({
          id: 11,
          status: 'accepted',
          userAId: 2,
          userBId: 3,
          addresseeId: 3,
          userA: viewerRow,
          userB: friendAsUserB,
        }),
      ]);

      const result = await service.getFriends(viewer(2), 2);

      const friendUserSelect = {
        id: true,
        username: true,
        avatarUrl: true,
        isOnline: true,
      };
      const ability = new CaslAbilityFactory().createForUser(viewer(2));
      expect(prisma.friendship.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            accessibleBy(ability, 'read').ofType('Friendship'),
            {
              deletedAt: null,
              status: 'accepted',
              OR: [{ userAId: 2 }, { userBId: 2 }],
            },
          ],
        },
        include: {
          userA: { select: friendUserSelect },
          userB: { select: friendUserSelect },
        },
      });
      expect(result).toEqual([
        {
          friendshipId: 10,
          status: 'accepted',
          createdAt: new Date('2024-01-01'),
          user: friendAsUserA,
        },
        {
          friendshipId: 11,
          status: 'accepted',
          createdAt: new Date('2024-01-01'),
          user: friendAsUserB,
        },
      ]);
    });

    it("excludes the viewer from another user's friend list", async () => {
      prisma.friendship.findMany.mockResolvedValue([]);

      await service.getFriends(viewer(1), 2);

      const [args] = prisma.friendship.findMany.mock.calls[0] as [
        { where: { AND: [unknown, Record<string, unknown>] } },
      ];
      expect(args.where.AND[1]).toEqual({
        deletedAt: null,
        status: 'accepted',
        OR: [{ userAId: 2 }, { userBId: 2 }],
        NOT: [{ userAId: 1 }, { userBId: 1 }],
      });
    });

    it('does not filter anyone out of your own friend list', async () => {
      prisma.friendship.findMany.mockResolvedValue([]);

      await service.getFriends(viewer(1), 1);

      const [args] = prisma.friendship.findMany.mock.calls[0] as [
        { where: { AND: [unknown, Record<string, unknown>] } },
      ];
      expect(args.where.AND[1]).not.toHaveProperty('NOT');
    });
  });

  describe('getFriendRequests', () => {
    it("rejects viewing another user's pending requests", async () => {
      await expect(
        service.getFriendRequests(viewer(1), 2),
      ).rejects.toBeInstanceOf(ForbiddenError);
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
          userAId: 1,
          userBId: 2,
          addresseeId: 1,
          userA: {
            id: 1,
            username: 'alice',
            avatarUrl: '/uploads/avatars/default.svg',
            isOnline: false,
          },
          userB: requester,
        }),
      ]);

      const result = await service.getFriendRequests(viewer(1), 1);

      const friendUserSelect = {
        id: true,
        username: true,
        avatarUrl: true,
        isOnline: true,
      };
      expect(prisma.friendship.findMany).toHaveBeenCalledWith({
        where: { addresseeId: 1, status: 'pending', deletedAt: null },
        include: {
          userA: { select: friendUserSelect },
          userB: { select: friendUserSelect },
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

    function lookup(pairRow: unknown, freshRow: unknown = pairRow) {
      prisma.friendship.findUnique.mockImplementation(({ where }) =>
        Promise.resolve('id' in where ? freshRow : pairRow),
      );
    }

    it('rejects sending a friend request to yourself', async () => {
      await expect(
        service.createFriendRequest(viewer(1), 1),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.friendship.findUnique).not.toHaveBeenCalled();
      expect(prisma.friendship.upsert).not.toHaveBeenCalled();
    });

    it('rejects when a block exists between the two users, in either direction', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.createFriendRequest(viewer(1), 2),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.friendship.findUnique).not.toHaveBeenCalled();
      expect(prisma.friendship.upsert).not.toHaveBeenCalled();
    });

    it('looks the pair up by its canonical key', async () => {
      const created = makeFriendship({ status: 'pending' });
      lookup(null, created);
      prisma.friendship.upsert.mockResolvedValue(created);

      await service.createFriendRequest(viewer(2), 1);

      expect(prisma.friendship.findUnique).toHaveBeenCalledWith({
        where: { userAId_userBId: { userAId: 1, userBId: 2 } },
      });
    });

    it('rejects when an accepted friendship already exists', async () => {
      lookup(makeFriendship({ status: 'accepted' }));

      await expect(
        service.createFriendRequest(viewer(1), 2),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.friendship.upsert).not.toHaveBeenCalled();
    });

    it('returns the pending request unchanged when the caller already sent it', async () => {
      const pending = makeFriendship({ status: 'pending' });
      lookup(pending);

      const result = await service.createFriendRequest(viewer(1), 2);

      expect(result.status).toBe('pending');
      expect(prisma.friendship.upsert).not.toHaveBeenCalled();
      expect(prisma.friendship.update).not.toHaveBeenCalled();
      expect(notifications.notifyFriendRequest).not.toHaveBeenCalled();
      expect(notifications.notifyFriendAccepted).not.toHaveBeenCalled();
    });

    it('accepts directly when the target already sent a pending request', async () => {
      const incoming = makeFriendship({
        id: 10,
        status: 'pending',
        addresseeId: 1,
      });
      lookup(incoming);
      prisma.friendship.update.mockResolvedValue({
        ...incoming,
        status: 'accepted',
      });

      const result = await service.createFriendRequest(viewer(1), 2);

      expect(prisma.friendship.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { status: 'accepted' },
      });
      expect(notifications.clearFriendRequest).toHaveBeenCalledWith(1, 2);
      expect(notifications.notifyFriendAccepted).toHaveBeenCalledWith(2, 1);
      expect(result.status).toBe('accepted');
    });

    it('creates the row and notifies the addressee when no relation exists', async () => {
      const created = makeFriendship({ status: 'pending' });
      lookup(null, created);
      prisma.friendship.upsert.mockResolvedValue(created);

      const result = await service.createFriendRequest(viewer(1), 2);

      expect(prisma.friendship.upsert).toHaveBeenCalledWith({
        where: { userAId_userBId: { userAId: 1, userBId: 2 } },
        create: {
          userAId: 1,
          userBId: 2,
          addresseeId: 2,
          status: 'pending',
        },
        update: {
          status: 'pending',
          addresseeId: 2,
          deletedAt: null,
          createdAt: expect.any(Date) as Date,
        },
      });
      expect(notifications.notifyFriendRequest).toHaveBeenCalledWith(2, 1);
      expect(result.status).toBe('pending');
    });

    it('revives the single row of the pair instead of adding a second one', async () => {
      const dead = makeFriendship({
        id: 10,
        status: 'rejected',
        deletedAt: new Date('2024-02-01'),
      });
      const revived = makeFriendship({ id: 10, status: 'pending' });
      lookup(dead, revived);
      prisma.friendship.upsert.mockResolvedValue(revived);

      await service.createFriendRequest(viewer(1), 2);

      expect(prisma.friendship.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userAId_userBId: { userAId: 1, userBId: 2 } },
        }),
      );
      expect(prisma.friendship.create).not.toHaveBeenCalled();
    });

    it('reopens a rejected relation and points it at the new addressee', async () => {
      const rejected = makeFriendship({
        id: 10,
        status: 'rejected',
        addresseeId: 1,
      });
      const reopened = makeFriendship({ id: 10, status: 'pending' });
      lookup(rejected, reopened);
      prisma.friendship.upsert.mockResolvedValue(reopened);

      await service.createFriendRequest(viewer(1), 2);

      const [args] = prisma.friendship.upsert.mock.calls[0];
      expect(args.update).toMatchObject({
        status: 'pending',
        addresseeId: 2,
        deletedAt: null,
      });
    });

    it('retries the resolution once when the unique index rejects the upsert', async () => {
      const mirror = makeFriendship({
        id: 13,
        status: 'pending',
        addresseeId: 1,
      });
      prisma.friendship.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mirror);
      prisma.friendship.upsert.mockRejectedValue(uniqueViolation());
      prisma.friendship.update.mockResolvedValue({
        ...mirror,
        status: 'accepted',
      });

      const result = await service.createFriendRequest(viewer(1), 2);

      expect(prisma.friendship.upsert).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('accepted');
    });

    it('reports the accepted state when a concurrent request accepted first', async () => {
      const created = makeFriendship({ id: 12, status: 'pending' });
      lookup(null, { ...created, status: 'accepted' });
      prisma.friendship.upsert.mockResolvedValue(created);

      const result = await service.createFriendRequest(viewer(1), 2);

      expect(result.status).toBe('accepted');
      expect(notifications.notifyFriendRequest).not.toHaveBeenCalled();
      expect(notifications.notifyFriendAccepted).not.toHaveBeenCalled();
      expect(notifications.clearFriendRequest).toHaveBeenCalledWith(2, 1);
    });

    it('propagates errors that are not unique violations', async () => {
      lookup(null);
      prisma.friendship.upsert.mockRejectedValue(new Error('boom'));

      await expect(service.createFriendRequest(viewer(1), 2)).rejects.toThrow(
        'boom',
      );
      expect(prisma.friendship.findUnique).toHaveBeenCalledTimes(1);
    });
  });
  describe('updateFriendRequest', () => {
    it('throws when there is no pending request from that user', async () => {
      prisma.friendship.findFirst.mockResolvedValue(null);

      await expect(
        service.updateFriendRequest(viewer(1), 2, 'accepted'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.friendship.update).not.toHaveBeenCalled();
    });

    it('looks up the friendship between the two users regardless of direction', async () => {
      prisma.friendship.findFirst.mockResolvedValue(null);

      await service
        .updateFriendRequest(viewer(1), 2, 'accepted')
        .catch(() => undefined);

      expect(prisma.friendship.findFirst).toHaveBeenCalledWith({
        where: { userAId: 1, userBId: 2, deletedAt: null },
      });
    });

    it('rejects when the caller is the requester, not the addressee', async () => {
      const pending = makeFriendship({
        id: 10,
        status: 'pending',
        userAId: 1,
        userBId: 2,
        addresseeId: 2,
      });
      prisma.friendship.findFirst.mockResolvedValue(pending);

      await expect(
        service.updateFriendRequest(viewer(1), 2, 'accepted'),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(prisma.friendship.update).not.toHaveBeenCalled();
    });

    it('rejects when the friendship exists but is no longer pending', async () => {
      const accepted = makeFriendship({
        id: 10,
        status: 'accepted',
        userAId: 1,
        userBId: 2,
        addresseeId: 1,
      });
      prisma.friendship.findFirst.mockResolvedValue(accepted);

      await expect(
        service.updateFriendRequest(viewer(1), 2, 'rejected'),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(prisma.friendship.update).not.toHaveBeenCalled();
    });

    it('rejects the requester accepting an already accepted friendship', async () => {
      prisma.friendship.findFirst.mockResolvedValue(
        makeFriendship({ id: 10, status: 'accepted' }),
      );

      await expect(
        service.updateFriendRequest(viewer(1), 2, 'accepted'),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(prisma.friendship.update).not.toHaveBeenCalled();
    });

    it('is idempotent when accepting an already accepted friendship', async () => {
      const accepted = makeFriendship({
        id: 10,
        status: 'accepted',
        userAId: 1,
        userBId: 2,
        addresseeId: 1,
      });
      prisma.friendship.findFirst.mockResolvedValue(accepted);

      const result = await service.updateFriendRequest(
        viewer(1),
        2,
        'accepted',
      );

      expect(result.status).toBe('accepted');
      expect(prisma.friendship.update).not.toHaveBeenCalled();
      expect(notifications.clearFriendRequest).toHaveBeenCalledWith(1, 2);
    });

    it('updates the status when a pending request exists', async () => {
      const pending = makeFriendship({
        id: 10,
        status: 'pending',
        userAId: 1,
        userBId: 2,
        addresseeId: 1,
      });
      prisma.friendship.findFirst.mockResolvedValue(pending);
      prisma.friendship.update.mockResolvedValue({
        ...pending,
        status: 'accepted',
      });

      const result = await service.updateFriendRequest(
        viewer(1),
        2,
        'accepted',
      );

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
        userAId: 1,
        userBId: 2,
        addresseeId: 1,
      });
      prisma.friendship.findFirst.mockResolvedValue(pending);
      prisma.friendship.update.mockResolvedValue({
        ...pending,
        status: 'rejected',
      });

      const result = await service.updateFriendRequest(
        viewer(1),
        2,
        'rejected',
      );

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

      await expect(
        service.removeFriendship(viewer(1), 2),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.friendship.update).not.toHaveBeenCalled();
    });

    it('soft-deletes the friendship when found', async () => {
      prisma.friendship.findFirst.mockResolvedValue(makeFriendship({ id: 10 }));
      prisma.friendship.update.mockResolvedValue(undefined);

      await service.removeFriendship(viewer(1), 2);

      const [args] = prisma.friendship.update.mock.calls[0];
      expect(args.where).toEqual({ id: 10 });
      expect(args.data.deletedAt).toBeInstanceOf(Date);
      expect(notifications.clearFriendRequest).toHaveBeenCalledWith(2, 1);
    });

    it('clears the notification of the addressee sitting in the first slot', async () => {
      prisma.friendship.findFirst.mockResolvedValue(
        makeFriendship({ id: 10, addresseeId: 1 }),
      );
      prisma.friendship.update.mockResolvedValue(undefined);

      await service.removeFriendship(viewer(1), 2);

      expect(notifications.clearFriendRequest).toHaveBeenCalledWith(1, 2);
    });
  });

  describe('friendIds', () => {
    it('maps each accepted friendship to the other user id', async () => {
      prisma.friendship.findMany.mockResolvedValue([
        makeFriendship({ userAId: 1, userBId: 2, addresseeId: 2 }),
        makeFriendship({ userAId: 1, userBId: 3, addresseeId: 1 }),
      ]);

      const ids = await service.friendIds(1);

      expect(prisma.friendship.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          status: 'accepted',
          OR: [{ userAId: 1 }, { userBId: 1 }],
        },
        select: { userAId: true, userBId: true },
      });
      expect(ids).toEqual([2, 3]);
    });
  });
});
