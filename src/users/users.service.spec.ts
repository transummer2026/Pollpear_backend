import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ForbiddenError } from '@casl/ability';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { UsersService } from './users.service';

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    username: 'alice',
    name: null,
    surname: null,
    email: 'alice@example.com',
    birthdate: new Date('2000-01-01'),
    passwordHash: 'hash',
    role: 'user',
    gender: 'other',
    nationality: 'French',
    city: null,
    state: null,
    country: null,
    company: null,
    bio: null,
    score: 0,
    isOnline: false,
    isEmailVerified: true,
    visibility: 'public',
    lastSeenAt: null,
    avatarUrl: '/uploads/avatars/default.svg',
    bannerUrl: '/uploads/banners/default.svg',
    userTheme: 'light',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
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

const SEARCH_SELECT = {
  id: true,
  username: true,
  name: true,
  surname: true,
  avatarUrl: true,
};

function searchRow(id: number, username = `user${id}`) {
  return {
    id,
    username,
    name: null,
    surname: null,
    avatarUrl: '/uploads/avatars/default.svg',
  };
}

type FindFirstArgs = { where: Record<string, unknown> };
type FindManyArgs = {
  where: Record<string, unknown>;
  include: Record<string, unknown>;
};
type UpsertArgs = {
  where: Record<string, unknown>;
  create: Record<string, unknown>;
  update: Record<string, unknown>;
};
type UpdateArgs = { where: { id: number }; data: Record<string, unknown> };
type UpdateManyArgs = {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
};
type BlockUniqueArgs = {
  where: { blockerId_blockedId: { blockerId: number; blockedId: number } };
};
type BlockCreateArgs = { data: Record<string, unknown> };
type BlockDeleteArgs = { where: { id: number } };

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findFirst: jest.Mock<Promise<unknown>, [FindFirstArgs]>;
      findUniqueOrThrow: jest.Mock<Promise<unknown>, [FindFirstArgs]>;
      findMany: jest.Mock<Promise<unknown[]>, [Record<string, unknown>]>;
      update: jest.Mock<Promise<unknown>, [UpdateArgs]>;
      updateMany: jest.Mock<Promise<unknown>, [UpdateManyArgs]>;
    };
    ban: { findFirst: jest.Mock<Promise<unknown>, [FindFirstArgs]> };
    friendship: {
      findFirst: jest.Mock<Promise<unknown>, [FindFirstArgs]>;
      findMany: jest.Mock<Promise<unknown[]>, [FindManyArgs]>;
      upsert: jest.Mock<Promise<unknown>, [UpsertArgs]>;
      update: jest.Mock<Promise<unknown>, [UpdateArgs]>;
      updateMany: jest.Mock<Promise<unknown>, [UpdateManyArgs]>;
    };
    block: {
      findUnique: jest.Mock<Promise<unknown>, [BlockUniqueArgs]>;
      findMany: jest.Mock<Promise<unknown[]>, [FindManyArgs]>;
      findFirst: jest.Mock<Promise<unknown>, [FindFirstArgs]>;
      create: jest.Mock<Promise<unknown>, [BlockCreateArgs]>;
      delete: jest.Mock<Promise<unknown>, [BlockDeleteArgs]>;
    };
    $transaction: jest.Mock<Promise<unknown[]>, [Promise<unknown>[]]>;
  };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn<Promise<unknown>, [FindFirstArgs]>(),
        findUniqueOrThrow: jest
          .fn<Promise<unknown>, [FindFirstArgs]>()
          .mockResolvedValue(makeUser({ id: 1 })),
        findMany: jest.fn<Promise<unknown[]>, [Record<string, unknown>]>(),
        update: jest.fn<Promise<unknown>, [UpdateArgs]>(),
        updateMany: jest.fn<Promise<unknown>, [UpdateManyArgs]>(),
      },
      ban: { findFirst: jest.fn<Promise<unknown>, [FindFirstArgs]>() },
      friendship: {
        findFirst: jest.fn<Promise<unknown>, [FindFirstArgs]>(),
        findMany: jest.fn<Promise<unknown[]>, [FindManyArgs]>(),
        upsert: jest.fn<Promise<unknown>, [UpsertArgs]>(),
        update: jest.fn<Promise<unknown>, [UpdateArgs]>(),
        updateMany: jest.fn<Promise<unknown>, [UpdateManyArgs]>(),
      },
      block: {
        findUnique: jest.fn<Promise<unknown>, [BlockUniqueArgs]>(),
        findMany: jest.fn<Promise<unknown[]>, [FindManyArgs]>(),
        findFirst: jest.fn<Promise<unknown>, [FindFirstArgs]>(),
        create: jest.fn<Promise<unknown>, [BlockCreateArgs]>(),
        delete: jest.fn<Promise<unknown>, [BlockDeleteArgs]>(),
      },
      $transaction: jest
        .fn<Promise<unknown[]>, [Promise<unknown>[]]>()
        .mockImplementation((ops) => Promise.all(ops)),
    };
    service = new UsersService(
      prisma as unknown as PrismaService,
      new CaslAbilityFactory(),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('returns only the public profile fields when found', async () => {
      prisma.user.findFirst.mockResolvedValue(makeUser());

      const result = await service.findOne(1);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
      });
      expect(result.username).toBe('alice');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('birthdate');
      expect(result).not.toHaveProperty('gender');
      expect(result).not.toHaveProperty('nationality');
      expect(result).not.toHaveProperty('bio');
      expect(result).not.toHaveProperty('role');
    });

    it('throws NotFoundException when the user does not exist', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
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
      const friendAsAddressee = makeUser({ id: 2, username: 'friend-2' });
      const friendAsRequester = makeUser({ id: 3, username: 'friend-3' });
      prisma.friendship.findMany.mockResolvedValue([
        makeFriendship({
          id: 10,
          status: 'accepted',
          requesterId: 1,
          addresseeId: 2,
          requester: makeUser({ id: 1 }),
          addressee: friendAsAddressee,
        }),
        makeFriendship({
          id: 11,
          status: 'accepted',
          requesterId: 3,
          addresseeId: 1,
          requester: friendAsRequester,
          addressee: makeUser({ id: 1 }),
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
          user: {
            id: 2,
            username: 'friend-2',
            avatarUrl: '/uploads/avatars/default.svg',
            isOnline: false,
          },
        },
        {
          friendshipId: 11,
          status: 'accepted',
          createdAt: new Date('2024-01-01'),
          user: {
            id: 3,
            username: 'friend-3',
            avatarUrl: '/uploads/avatars/default.svg',
            isOnline: false,
          },
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
      const requester = makeUser({ id: 2, username: 'friend-2' });
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
          user: {
            id: 2,
            username: 'friend-2',
            avatarUrl: '/uploads/avatars/default.svg',
            isOnline: false,
          },
        },
      ]);
    });
  });

  describe('createFriendRequest', () => {
    it('rejects sending a friend request to yourself', async () => {
      await expect(service.createFriendRequest(1, 1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.friendship.findFirst).not.toHaveBeenCalled();
      expect(prisma.friendship.upsert).not.toHaveBeenCalled();
    });

    it('rejects when a pending friendship already exists', async () => {
      prisma.friendship.findFirst.mockResolvedValue(
        makeFriendship({ status: 'pending' }),
      );

      await expect(service.createFriendRequest(1, 2)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.friendship.upsert).not.toHaveBeenCalled();
    });

    it('rejects when an accepted friendship already exists', async () => {
      prisma.friendship.findFirst.mockResolvedValue(
        makeFriendship({ status: 'accepted' }),
      );

      await expect(service.createFriendRequest(1, 2)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.friendship.upsert).not.toHaveBeenCalled();
    });

    it('rejects when a block exists between the two users, in either direction', async () => {
      prisma.block.findFirst.mockResolvedValue(makeBlock());

      await expect(service.createFriendRequest(1, 2)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.friendship.findFirst).not.toHaveBeenCalled();
      expect(prisma.friendship.upsert).not.toHaveBeenCalled();
    });

    it('revives a rejected friendship in place instead of conflicting', async () => {
      const rejected = makeFriendship({
        id: 10,
        status: 'rejected',
        requesterId: 2,
        addresseeId: 1,
      });
      prisma.friendship.findFirst.mockResolvedValue(rejected);
      prisma.friendship.update.mockResolvedValue({
        ...rejected,
        requesterId: 1,
        addresseeId: 2,
        status: 'pending',
      });

      const result = await service.createFriendRequest(1, 2);

      expect(prisma.friendship.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { requesterId: 1, addresseeId: 2, status: 'pending' },
      });
      expect(prisma.friendship.upsert).not.toHaveBeenCalled();
      expect(result.status).toBe('pending');
    });

    it('revives a rejected friendship when the caller re-requests in the same original direction', async () => {
      const rejected = makeFriendship({
        id: 10,
        status: 'rejected',
        requesterId: 1,
        addresseeId: 2,
      });
      prisma.friendship.findFirst.mockResolvedValue(rejected);
      prisma.friendship.update.mockResolvedValue({
        ...rejected,
        status: 'pending',
      });

      const result = await service.createFriendRequest(1, 2);

      expect(prisma.friendship.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { requesterId: 1, addresseeId: 2, status: 'pending' },
      });
      expect(prisma.friendship.upsert).not.toHaveBeenCalled();
      expect(result.status).toBe('pending');
    });

    it('upserts on the (requester, addressee) pair when no active relation exists', async () => {
      prisma.friendship.findFirst.mockResolvedValue(null);
      prisma.friendship.upsert.mockResolvedValue(makeFriendship());

      await service.createFriendRequest(1, 2);

      expect(prisma.friendship.upsert).toHaveBeenCalledWith({
        where: {
          requesterId_addresseeId: { requesterId: 1, addresseeId: 2 },
        },
        create: { requesterId: 1, addresseeId: 2, status: 'pending' },
        update: { status: 'pending', deletedAt: null },
      });
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

    it('only matches a request where the caller is the addressee', async () => {
      prisma.friendship.findFirst.mockResolvedValue(null);

      await service
        .updateFriendRequest(1, 2, 'accepted')
        .catch(() => undefined);

      expect(prisma.friendship.findFirst).toHaveBeenCalledWith({
        where: {
          requesterId: 2,
          addresseeId: 1,
          status: 'pending',
          deletedAt: null,
        },
      });
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

  describe('getBlockStatus', () => {
    it('reports blockedByMe when only the caller has blocked the target', async () => {
      prisma.block.findUnique
        .mockResolvedValueOnce(makeBlock({ blockerId: 1, blockedId: 2 }))
        .mockResolvedValueOnce(null);

      const result = await service.getBlockStatus(1, 2);

      expect(prisma.block.findUnique).toHaveBeenNthCalledWith(1, {
        where: { blockerId_blockedId: { blockerId: 1, blockedId: 2 } },
      });
      expect(prisma.block.findUnique).toHaveBeenNthCalledWith(2, {
        where: { blockerId_blockedId: { blockerId: 2, blockedId: 1 } },
      });
      expect(result).toEqual({ blockedByMe: true, blockedMe: false });
    });

    it('reports blockedMe when only the target has blocked the caller', async () => {
      prisma.block.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeBlock({ blockerId: 2, blockedId: 1 }));

      const result = await service.getBlockStatus(1, 2);

      expect(result).toEqual({ blockedByMe: false, blockedMe: true });
    });

    it('reports both flags true on a mutual block', async () => {
      prisma.block.findUnique
        .mockResolvedValueOnce(makeBlock({ blockerId: 1, blockedId: 2 }))
        .mockResolvedValueOnce(makeBlock({ blockerId: 2, blockedId: 1 }));

      const result = await service.getBlockStatus(1, 2);

      expect(result).toEqual({ blockedByMe: true, blockedMe: true });
    });

    it('reports both flags false when no block exists', async () => {
      prisma.block.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await service.getBlockStatus(1, 2);

      expect(result).toEqual({ blockedByMe: false, blockedMe: false });
    });
  });

  describe('getBlockedUsers', () => {
    it("rejects viewing another user's blocked users", async () => {
      await expect(service.getBlockedUsers(1, 2)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      expect(prisma.block.findMany).not.toHaveBeenCalled();
    });

    it('returns users blocked by the caller, mapped to the blocked user', async () => {
      const blocked = makeUser({ id: 2, username: 'blocked-2' });
      prisma.block.findMany.mockResolvedValue([
        makeBlock({ id: 20, blockerId: 1, blockedId: 2, blocked }),
      ]);

      const result = await service.getBlockedUsers(1, 1);

      expect(prisma.block.findMany).toHaveBeenCalledWith({
        where: { blockerId: 1 },
        include: {
          blocked: { select: { id: true, username: true, avatarUrl: true } },
        },
      });
      expect(result).toEqual([
        {
          blockId: 20,
          createdAt: new Date('2024-01-01'),
          user: {
            id: 2,
            username: 'blocked-2',
            avatarUrl: '/uploads/avatars/default.svg',
          },
        },
      ]);
    });
  });

  describe('blockUser', () => {
    it('rejects blocking yourself', async () => {
      await expect(service.blockUser(1, 1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.block.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects when the caller already blocked the target', async () => {
      prisma.block.findUnique.mockResolvedValue(makeBlock());

      await expect(service.blockUser(1, 2)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates the block and soft-deletes any friendship between the two users', async () => {
      prisma.block.findUnique.mockResolvedValue(null);
      prisma.block.create.mockResolvedValue(makeBlock());
      prisma.friendship.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.blockUser(1, 2);

      expect(prisma.block.create).toHaveBeenCalledWith({
        data: { blockerId: 1, blockedId: 2 },
      });
      expect(prisma.friendship.updateMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          OR: [
            { requesterId: 1, addresseeId: 2 },
            { requesterId: 2, addresseeId: 1 },
          ],
        },
        data: { deletedAt: expect.any(Date) as Date },
      });
      expect(result.blockerId).toBe(1);
      expect(result.blockedId).toBe(2);
    });

    it('only checks its own direction, allowing a mutual block even if the target already blocked the caller', async () => {
      prisma.block.findUnique.mockResolvedValue(null);
      prisma.block.create.mockResolvedValue(
        makeBlock({ id: 21, blockerId: 1, blockedId: 2 }),
      );
      prisma.friendship.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.blockUser(1, 2);

      expect(prisma.block.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.block.findUnique).toHaveBeenCalledWith({
        where: { blockerId_blockedId: { blockerId: 1, blockedId: 2 } },
      });
      expect(result.blockerId).toBe(1);
      expect(result.blockedId).toBe(2);
    });
  });

  describe('unblockUser', () => {
    it('throws when the caller has not blocked the target', async () => {
      prisma.block.findUnique.mockResolvedValue(null);

      await expect(service.unblockUser(1, 2)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.block.delete).not.toHaveBeenCalled();
    });

    it('deletes the block when found', async () => {
      prisma.block.findUnique.mockResolvedValue(makeBlock({ id: 20 }));
      prisma.block.delete.mockResolvedValue(undefined);

      await service.unblockUser(1, 2);

      expect(prisma.block.delete).toHaveBeenCalledWith({ where: { id: 20 } });
    });
  });

  describe('search', () => {
    it('ranks username prefixes first and fills the rest with contains matches', async () => {
      const prefixed = [searchRow(1, 'ali'), searchRow(2, 'alice')];
      const contained = [searchRow(3, 'magali')];
      prisma.user.findMany
        .mockResolvedValueOnce(prefixed)
        .mockResolvedValueOnce(contained);

      await expect(service.search('ali')).resolves.toEqual([
        ...prefixed,
        ...contained,
      ]);

      expect(prisma.user.findMany).toHaveBeenNthCalledWith(1, {
        where: {
          deletedAt: null,
          visibility: { not: 'private' },
          username: { startsWith: 'ali', mode: 'insensitive' },
        },
        select: SEARCH_SELECT,
        orderBy: { username: 'asc' },
        take: 5,
      });
      expect(prisma.user.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          deletedAt: null,
          visibility: { not: 'private' },
          id: { notIn: [1, 2] },
          OR: [
            { username: { contains: 'ali', mode: 'insensitive' } },
            { name: { contains: 'ali', mode: 'insensitive' } },
            { surname: { contains: 'ali', mode: 'insensitive' } },
          ],
        },
        select: SEARCH_SELECT,
        orderBy: { username: 'asc' },
        take: 3,
      });
    });

    it('skips the contains query when prefixes already fill the limit', async () => {
      const prefixed = [1, 2, 3, 4, 5].map((id) => searchRow(id));
      prisma.user.findMany.mockResolvedValueOnce(prefixed);

      await expect(service.search('user')).resolves.toEqual(prefixed);

      expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('findByUserId', () => {
    it('rejects an invalid id before touching the database', async () => {
      await expect(service.findByUserId(NaN)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('looks up only non-deleted users', async () => {
      const user = makeUser({ id: 42 });
      prisma.user.findFirst.mockResolvedValue(user);

      await expect(service.findByUserId(42)).resolves.toBe(user);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 42, deletedAt: null },
      });
    });
  });

  describe('findByBanStatus', () => {
    it('matches only bans that have not ended yet', async () => {
      const ban = { id: 1 };
      prisma.ban.findFirst.mockResolvedValue(ban);

      await expect(service.findByBanStatus(42)).resolves.toBe(ban);

      expect(prisma.ban.findFirst).toHaveBeenCalledWith({
        where: { userId: 42, endedAt: { gt: expect.any(Date) as Date } },
      });
    });
  });

  describe('setOnline', () => {
    it('marks the user online', async () => {
      await service.setOnline(7);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { isOnline: true },
      });
    });
  });

  describe('setOffline', () => {
    afterEach(() => jest.useRealTimers());

    it('marks the user offline and stamps the last seen date', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-19T12:00:00Z'));

      await service.setOffline(7);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { isOnline: false, lastSeenAt: new Date('2026-08-19T12:00:00Z') },
      });
    });
  });

  describe('resetOnlineStatus', () => {
    it('resets every user still flagged online and reports how many', async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 3 });

      await expect(service.resetOnlineStatus()).resolves.toBe(3);

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { isOnline: true },
        data: { isOnline: false },
      });
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
