import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiUsersController } from '../src/api/v1/users/users.controller';
import { ApiUsersService } from '../src/api/v1/users/users.service';
import { ApiUserProfileController } from '../src/api/v1/users/profile/profile.controller';
import { ApiUserProfileService } from '../src/api/v1/users/profile/profile.service';
import { CaslAbilityFactory } from '../src/casl/casl-ability.factory';
import { AuthorizationGuard } from '../src/casl/authorization.guard';
import { AuthGuard } from '../src/auth/auth.guard';
import { UsersService } from '../src/users/users.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { type User } from '../src/generated/prisma/client';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filters';
import { CaslExceptionFilter } from '../src/common/filters/casl-exception.filters';
import { LIMIT_BY_ROLE } from '../src/api/v1/common/schemas/api-pagination.schema';
import type { ApiUserPageDTO } from '../src/api/v1/common/schemas/api-users.schema';

/**
 * Exercises the real HTTP path for GET /v1/users and GET /v1/users/:id:
 * AuthGuard, AuthorizationGuard with the real permission rules, the Zod
 * query and param pipes, the controllers and the response shape, all wired
 * for real. Only persistence (Prisma) and identity lookup (UsersService,
 * standing in for the gateway's x-user-id header) are faked, so this needs
 * neither a database nor the Rust gateway in front of it.
 */
describe('Public user routes (e2e)', () => {
  let app: INestApplication<App>;

  const usersById: Record<number, User> = {
    1: { id: 1, role: 'admin' } as User,
    2: { id: 2, role: 'moderator' } as User,
    3: { id: 3, role: 'user' } as User,
  };

  const findByUserId = jest.fn((id: number) =>
    Promise.resolve(usersById[id] ?? null),
  );
  type Queried = { where: Record<string, unknown>; skip: number; take: number };

  const findMany = jest.fn<Promise<unknown>, [Queried]>();
  const count = jest.fn();
  const findFirst = jest.fn<Promise<unknown>, [Queried]>();
  const transaction = jest.fn();

  /** A row as the list reads it: the payload columns, plus the three the state is computed from. */
  const listed = {
    id: 7,
    username: 'pollpear',
    avatarUrl: '/uploads/avatars/default.svg',
    score: 12,
    deletedAt: null,
    bansReceived: [],
    blocksReceived: [],
  };

  const profile = {
    id: 7,
    username: 'pollpear',
    bio: null,
    avatarUrl: 'https://cdn.pollpear.com/avatars/7.webp',
    score: 12,
    deletedAt: null,
    bansReceived: [],
    blocksReceived: [],
    _count: {
      friendshipsRequested: 3,
      friendshipsReceived: 1,
      roomMemberships: 2,
      pollsCreated: 9,
    },
  };

  const answerList = (rows: unknown[], total = rows.length) =>
    transaction.mockResolvedValue([rows, total]);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ApiUsersController, ApiUserProfileController],
      providers: [
        ApiUsersService,
        ApiUserProfileService,
        CaslAbilityFactory,
        Reflector,
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: AuthorizationGuard },
        { provide: UsersService, useValue: { findByUserId } },
        {
          provide: PrismaService,
          useValue: {
            user: { findMany, count, findFirst },
            $transaction: transaction,
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(
      new PrismaExceptionFilter(),
      new CaslExceptionFilter(),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    [findByUserId, findMany, count, findFirst, transaction].forEach((fn) =>
      fn.mockClear(),
    );
  });

  const asUser = (id: number) => ({ 'x-user-id': String(id) });

  const whereOf = (fn: jest.Mock<Promise<unknown>, [Queried]>) =>
    fn.mock.calls[0][0].where;

  describe('GET /v1/users', () => {
    it('401s with no x-user-id header at all', () => {
      return request(app.getHttpServer()).get('/v1/users').expect(401);
    });

    it('401s an x-user-id that resolves to nobody', () => {
      return request(app.getHttpServer())
        .get('/v1/users')
        .set(asUser(404))
        .expect(401);
    });

    it('answers the page envelope, without the columns it reads to build it', () => {
      answerList([listed], 1);

      return request(app.getHttpServer())
        .get('/v1/users')
        .set(asUser(3))
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({
            data: [{ id: 7, username: 'pollpear', avatarUrl: null, score: 12 }],
            page: 1,
            limit: 20,
            total: 1,
          });
        });
    });

    it('pages from 1 with 20 rows when the query says nothing', () => {
      answerList([], 0);

      return request(app.getHttpServer())
        .get('/v1/users')
        .set(asUser(3))
        .expect(200)
        .expect(() => {
          expect(findMany.mock.calls[0][0]).toMatchObject({
            skip: 0,
            take: 20,
          });
        });
    });

    it('hides deleted and banned accounts from a plain caller', () => {
      answerList([], 0);

      return request(app.getHttpServer())
        .get('/v1/users')
        .set(asUser(3))
        .expect(200)
        .expect(() => {
          expect(whereOf(findMany)).toEqual({
            visibility: 'public',
            deletedAt: null,
            bansReceived: {
              none: {
                endedAt: { gt: expect.any(Date) as Date },
                unbannedById: null,
              },
            },
          });
        });
    });

    it('stops filtering bans for a moderator, on the real guarded path', () => {
      answerList([], 0);

      return request(app.getHttpServer())
        .get('/v1/users')
        .set(asUser(2))
        .expect(200)
        .expect(() => {
          expect(whereOf(findMany)).not.toHaveProperty('bansReceived');
          expect(whereOf(findMany).deletedAt).toBeNull();
        });
    });

    it('refuses a page larger than the caller role allows', () => {
      return request(app.getHttpServer())
        .get(`/v1/users?limit=${LIMIT_BY_ROLE.user + 1}`)
        .set(asUser(3))
        .expect(400)
        .expect(() => {
          expect(transaction).not.toHaveBeenCalled();
        });
    });

    it('lets a moderator ask for the same page a user is refused', () => {
      answerList([], 0);

      return request(app.getHttpServer())
        .get(`/v1/users?limit=${LIMIT_BY_ROLE.user + 1}`)
        .set(asUser(2))
        .expect(200);
    });

    it('refuses a limit past the highest ceiling, whoever asks', () => {
      return request(app.getHttpServer())
        .get(`/v1/users?limit=${LIMIT_BY_ROLE.admin + 1}`)
        .set(asUser(1))
        .expect(400);
    });

    it('refuses a page past the last one instead of answering it empty', () => {
      answerList([], 5);

      return request(app.getHttpServer())
        .get('/v1/users?page=2&limit=20')
        .set(asUser(3))
        .expect(400);
    });

    it('answers the first page of an empty list', () => {
      answerList([], 0);

      return request(app.getHttpServer())
        .get('/v1/users?page=1')
        .set(asUser(3))
        .expect(200);
    });

    it('400s a query parameter nobody declared', () => {
      return request(app.getHttpServer())
        .get('/v1/users?sort=score')
        .set(asUser(3))
        .expect(400);
    });

    it('flags an account the caller blocked, and nothing else', () => {
      answerList([{ ...listed, blocksReceived: [{ id: 1 }] }], 1);

      return request(app.getHttpServer())
        .get('/v1/users')
        .set(asUser(3))
        .expect(200)
        .expect((res) => {
          const page = res.body as ApiUserPageDTO;
          expect(page.data[0]).toMatchObject({ state: 'blocked' });
        });
    });

    it('says nothing of a state when there is none to report', () => {
      answerList([listed], 1);

      return request(app.getHttpServer())
        .get('/v1/users')
        .set(asUser(3))
        .expect(200)
        .expect((res) => {
          const page = res.body as ApiUserPageDTO;
          expect(page.data[0]).not.toHaveProperty('state');
        });
    });
  });

  describe('GET /v1/users/:id', () => {
    it('answers the profile with its three counters', () => {
      findFirst.mockResolvedValue(profile);

      return request(app.getHttpServer())
        .get('/v1/users/7')
        .set(asUser(3))
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({
            id: 7,
            username: 'pollpear',
            bio: null,
            avatarUrl: 'https://cdn.pollpear.com/avatars/7.webp',
            score: 12,
            pearsPals: 4,
            activeRooms: 2,
            pollsCreated: 9,
          });
        });
    });

    it('reads the profile behind the same visibility filter as the list', () => {
      findFirst.mockResolvedValue(profile);

      return request(app.getHttpServer())
        .get('/v1/users/7')
        .set(asUser(3))
        .expect(200)
        .expect(() => {
          expect(whereOf(findFirst)).toMatchObject({
            id: 7,
            visibility: 'public',
            deletedAt: null,
          });
        });
    });

    it('404s a profile the caller may not see, exactly like a missing one', () => {
      findFirst.mockResolvedValue(null);

      return request(app.getHttpServer())
        .get('/v1/users/7')
        .set(asUser(3))
        .expect(404);
    });

    it('tells an admin the account is deleted, rather than hiding it', () => {
      findFirst.mockResolvedValue({
        ...profile,
        deletedAt: new Date('2026-02-01'),
      });

      return request(app.getHttpServer())
        .get('/v1/users/7')
        .set(asUser(1))
        .expect(200)
        .expect((res) => {
          expect(res.body).toMatchObject({ state: 'deleted' });
          expect(whereOf(findFirst)).not.toHaveProperty('deletedAt');
        });
    });

    it('400s an id of zero, which can designate no account', () => {
      return request(app.getHttpServer())
        .get('/v1/users/0')
        .set(asUser(3))
        .expect(400)
        .expect(() => {
          expect(findFirst).not.toHaveBeenCalled();
        });
    });

    it('400s an id that is not a number', () => {
      return request(app.getHttpServer())
        .get('/v1/users/abc')
        .set(asUser(3))
        .expect(400);
    });

    it('401s before it ever reaches the database', () => {
      return request(app.getHttpServer())
        .get('/v1/users/7')
        .expect(401)
        .expect(() => {
          expect(findFirst).not.toHaveBeenCalled();
        });
    });
  });
});
