import { ForbiddenException, NotFoundException } from '@nestjs/common';
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
      count: jest.Mock<Promise<number>, [Record<string, unknown>]>;
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
        count: jest.fn<Promise<number>, [Record<string, unknown>]>(),
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

      const result = await service.findOne(1, 1);

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

      await expect(service.findOne(999, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('denies read on a private profile that is not the requester', async () => {
      prisma.user.findFirst.mockResolvedValue(
        makeUser({ id: 2, visibility: 'private' }),
      );

      await expect(service.findOne(2, 1)).rejects.toThrow(ForbiddenError);
    });

    it('allows the requester to read their own private profile', async () => {
      prisma.user.findFirst.mockResolvedValue(
        makeUser({ id: 1, visibility: 'private' }),
      );

      const result = await service.findOne(1, 1);
      expect(result.username).toBe('alice');
    });
  });

  describe('search', () => {
    const REQUESTER_ID = 1;
    // Derived from the CASL User-read policy for a plain 'user' role:
    // public users, or the requester's own profile. This has its own `OR`,
    // same as the multi-field search term below, so the two are composed
    // with `AND` rather than spread into one object — spreading two `OR`
    // keys into the same where-clause silently drops one of them.
    const readableBy = {
      OR: [{ id: REQUESTER_ID }, { visibility: { not: 'private' } }],
    };
    const baseWhere = { deletedAt: null, AND: [readableBy] };
    const matchWhere = (q: string) => ({
      deletedAt: null,
      AND: [
        readableBy,
        {
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { surname: { contains: q, mode: 'insensitive' } },
          ],
        },
      ],
    });
    const startsWithWhere = (q: string) => ({
      ...baseWhere,
      username: { startsWith: q, mode: 'insensitive' },
    });

    it('keeps the CASL visibility scope on a name/surname match instead of letting it get overwritten by the search-term OR', async () => {
      prisma.user.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      prisma.user.findMany.mockResolvedValueOnce([]);

      await service.search('surname-match', REQUESTER_ID);

      const countWhere = prisma.user.count.mock.calls[0][0].where as Record<
        string,
        unknown
      >;
      expect(countWhere.OR).toBeUndefined();
      expect(countWhere.AND).toContainEqual(readableBy);
    });

    it('ranks username prefixes first and fills the rest with contains matches', async () => {
      const prefixed = [searchRow(1, 'ali'), searchRow(2, 'alice')];
      const contained = [searchRow(3, 'magali')];
      prisma.user.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
      prisma.user.findMany
        .mockResolvedValueOnce(prefixed)
        .mockResolvedValueOnce(contained);

      await expect(service.search('ali', REQUESTER_ID)).resolves.toEqual({
        items: [...prefixed, ...contained],
        total: 3,
      });

      expect(prisma.user.count).toHaveBeenNthCalledWith(1, {
        where: matchWhere('ali'),
      });
      expect(prisma.user.count).toHaveBeenNthCalledWith(2, {
        where: startsWithWhere('ali'),
      });
      expect(prisma.user.findMany).toHaveBeenNthCalledWith(1, {
        where: startsWithWhere('ali'),
        select: SEARCH_SELECT,
        orderBy: { username: 'asc' },
        skip: 0,
        take: 5,
      });
      expect(prisma.user.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          ...matchWhere('ali'),
          NOT: { username: { startsWith: 'ali', mode: 'insensitive' } },
        },
        select: SEARCH_SELECT,
        orderBy: { username: 'asc' },
        skip: 0,
        take: 3,
      });
    });

    it('skips the contains query when prefixes already fill the limit', async () => {
      const prefixed = [1, 2, 3, 4, 5].map((id) => searchRow(id));
      prisma.user.count.mockResolvedValueOnce(5).mockResolvedValueOnce(5);
      prisma.user.findMany.mockResolvedValueOnce(prefixed);

      await expect(service.search('user', REQUESTER_ID)).resolves.toEqual({
        items: prefixed,
        total: 5,
      });

      expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    });

    it('walks skip/take across the prefix/contains boundary on later pages', async () => {
      // 6 prefix matches, page 2 at limit 5 starts 1 item into the prefix
      // phase's tail and needs 4 more from the contains phase.
      const prefixTail = [searchRow(6)];
      const contained = [
        searchRow(7),
        searchRow(8),
        searchRow(9),
        searchRow(10),
      ];
      prisma.user.count.mockResolvedValueOnce(10).mockResolvedValueOnce(6);
      prisma.user.findMany
        .mockResolvedValueOnce(prefixTail)
        .mockResolvedValueOnce(contained);

      await expect(
        service.search('user', REQUESTER_ID, { page: 2, limit: 5 }),
      ).resolves.toEqual({ items: [...prefixTail, ...contained], total: 10 });

      expect(prisma.user.findMany).toHaveBeenNthCalledWith(1, {
        where: startsWithWhere('user'),
        select: SEARCH_SELECT,
        orderBy: { username: 'asc' },
        skip: 5,
        take: 5,
      });
      expect(prisma.user.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          ...matchWhere('user'),
          NOT: { username: { startsWith: 'user', mode: 'insensitive' } },
        },
        select: SEARCH_SELECT,
        orderBy: { username: 'asc' },
        skip: 0,
        take: 4,
      });
    });

    it('orders alphabetically without the prefix phase when sortBy is alphabetical', async () => {
      const alphabetical = [searchRow(1, 'alice'), searchRow(2, 'bob')];
      prisma.user.count.mockResolvedValueOnce(2);
      prisma.user.findMany.mockResolvedValueOnce(alphabetical);

      await expect(
        service.search('a', REQUESTER_ID, { sortBy: 'alphabetical' }),
      ).resolves.toEqual({ items: alphabetical, total: 2 });

      expect(prisma.user.count).toHaveBeenCalledTimes(1);
      expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: matchWhere('a'),
        select: SEARCH_SELECT,
        orderBy: { username: 'asc' },
        skip: 0,
        take: 5,
      });
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
