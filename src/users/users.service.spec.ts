import { ForbiddenException, NotFoundException } from '@nestjs/common';
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
type UpdateArgs = { where: { id: number }; data: Record<string, unknown> };
type UpdateManyArgs = {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
};

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
});
