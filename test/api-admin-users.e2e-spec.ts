import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiAdminUserController } from '../src/api/v1/admin/users/users.controller';
import { ApiAdminUserService } from '../src/api/v1/admin/users/users.service';
import { CaslAbilityFactory } from '../src/casl/casl-ability.factory';
import { AuthorizationGuard } from '../src/casl/authorization.guard';
import { AuthGuard } from '../src/auth/auth.guard';
import { UsersService } from '../src/users/users.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MeService } from '../src/me/me.service';
import { Prisma, type User } from '../src/generated/prisma/client';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filters';
import { CaslExceptionFilter } from '../src/common/filters/casl-exception.filters';

/**
 * Exercises the real HTTP path for PATCH /v1/admin/users/:id: AuthGuard,
 * AuthorizationGuard (CASL, real permission rules), the Zod body pipe and
 * the controller, all wired for real. Only persistence (Prisma, MeService)
 * and identity lookup (UsersService, standing in for the gateway's
 * x-user-id header) are faked, so this needs neither a database nor the
 * Rust gateway in front of it.
 */
describe('ApiAdminUserController (e2e)', () => {
  let app: INestApplication<App>;

  const usersById: Record<number, User> = {
    1: { id: 1, role: 'admin' } as User,
    2: { id: 2, role: 'moderator' } as User,
    3: { id: 3, role: 'user' } as User,
  };

  const findByUserId = jest.fn((id: number) =>
    Promise.resolve(usersById[id] ?? null),
  );
  const findUnique = jest.fn();
  const update = jest.fn();
  const transaction = jest.fn();

  const columns = {
    id: 5,
    username: 'target',
    name: null,
    surname: null,
    email: 'target@pollpear.com',
    birthdate: new Date('1990-01-01'),
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
    isEmailVerified: false,
    visibility: 'public',
    lastSeenAt: null,
    avatarUrl: null,
    bannerUrl: null,
    userTheme: 'light',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
  };
  const totals = {
    pollsCreated: 0,
    roomsCreated: 0,
    votes: 0,
    messages: 0,
    bansReceived: 0,
    reportsGiven: 0,
    reportsReceived: 0,
    apiKeys: 0,
  };

  /** The row, then one count per statement the record batches after it. */
  const answer = (counts: number) => {
    findUnique.mockResolvedValue({ ...columns, _count: totals });
    transaction.mockResolvedValue([
      { ...columns, _count: totals },
      ...Array<number>(counts).fill(0),
    ]);
  };
  const asAdminRecord = () => answer(8);
  const asModerationRecord = () => answer(6);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ApiAdminUserController],
      providers: [
        ApiAdminUserService,
        CaslAbilityFactory,
        Reflector,
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: AuthorizationGuard },
        { provide: UsersService, useValue: { findByUserId } },
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique, update },
            poll: { count: jest.fn() },
            room: { count: jest.fn() },
            vote: { count: jest.fn() },
            message: { count: jest.fn() },
            ban: { count: jest.fn() },
            apiKey: { count: jest.fn() },
            $transaction: transaction,
          },
        },
        { provide: MeService, useValue: {} },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirrors main.ts: without these, a real Prisma "record not found"
    // would 500 here instead of the 404 the controller documents.
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
    [findByUserId, findUnique, update, transaction].forEach((fn) =>
      fn.mockClear(),
    );
    update.mockResolvedValue(undefined);
  });

  const asUser = (id: number) => ({ 'x-user-id': String(id) });

  it('401s with no x-user-id header at all', () => {
    return request(app.getHttpServer())
      .patch('/v1/admin/users/5')
      .send({ visibility: 'private' })
      .expect(401);
  });

  it('lets an admin change role and restore a deleted account', () => {
    asAdminRecord();

    return request(app.getHttpServer())
      .patch('/v1/admin/users/5')
      .set(asUser(1))
      .send({ role: 'admin', deletedAt: null })
      .expect(200)
      .expect((res) => {
        expect(update).toHaveBeenCalledWith({
          where: { id: 5 },
          data: { role: 'admin', deletedAt: null },
        });
        expect(res.body).toHaveProperty('email');
      });
  });

  it('lets a moderator change visibility and isEmailVerified', () => {
    asModerationRecord();

    return request(app.getHttpServer())
      .patch('/v1/admin/users/5')
      .set(asUser(2))
      .send({ visibility: 'private', isEmailVerified: true })
      .expect(200)
      .expect((res) => {
        expect(update).toHaveBeenCalledWith({
          where: { id: 5 },
          data: { visibility: 'private', isEmailVerified: true },
        });
        expect(res.body).not.toHaveProperty('email');
      });
  });

  it('403s a moderator touching role, and never calls prisma', () => {
    return request(app.getHttpServer())
      .patch('/v1/admin/users/5')
      .set(asUser(2))
      .send({ role: 'admin' })
      .expect(403)
      .expect(() => {
        expect(update).not.toHaveBeenCalled();
      });
  });

  it('403s a plain user outright: moderate is not even granted', () => {
    return request(app.getHttpServer())
      .patch('/v1/admin/users/5')
      .set(asUser(3))
      .send({ visibility: 'private' })
      .expect(403);
  });

  it('400s an unknown field such as name, before it reaches CASL', () => {
    return request(app.getHttpServer())
      .patch('/v1/admin/users/5')
      .set(asUser(1))
      .send({ name: 'bla' })
      .expect(400)
      .expect(() => {
        expect(update).not.toHaveBeenCalled();
      });
  });

  it('400s malformed JSON before it reaches any guard', () => {
    return request(app.getHttpServer())
      .patch('/v1/admin/users/5')
      .set(asUser(1))
      .set('Content-Type', 'application/json')
      .send('{"role": "admin"')
      .expect(400);
  });

  it('401s an x-user-id that resolves to nobody', () => {
    return request(app.getHttpServer())
      .patch('/v1/admin/users/5')
      .set(asUser(999))
      .send({ visibility: 'private' })
      .expect(401);
  });

  it('401s a non-numeric x-user-id', () => {
    return request(app.getHttpServer())
      .patch('/v1/admin/users/5')
      .set({ 'x-user-id': 'abc' })
      .send({ visibility: 'private' })
      .expect(401);
  });

  it('400s a non-numeric :id route param, before it reaches the guard', () => {
    return request(app.getHttpServer())
      .patch('/v1/admin/users/abc')
      .set(asUser(1))
      .send({ visibility: 'private' })
      .expect(400)
      .expect(() => {
        expect(update).not.toHaveBeenCalled();
      });
  });

  it('400s an empty body: the refine requires at least one field', () => {
    return request(app.getHttpServer())
      .patch('/v1/admin/users/5')
      .set(asUser(1))
      .send({})
      .expect(400)
      .expect(() => {
        expect(update).not.toHaveBeenCalled();
      });
  });

  it('400s an invalid role enum value', () => {
    return request(app.getHttpServer())
      .patch('/v1/admin/users/5')
      .set(asUser(1))
      .send({ role: 'superadmin' })
      .expect(400)
      .expect(() => {
        expect(update).not.toHaveBeenCalled();
      });
  });

  it('400s a deletedAt that is not null, even from an admin', () => {
    return request(app.getHttpServer())
      .patch('/v1/admin/users/5')
      .set(asUser(1))
      .send({ deletedAt: '2026-02-01T00:00:00.000Z' })
      .expect(400)
      .expect(() => {
        expect(update).not.toHaveBeenCalled();
      });
  });

  it('400s a deletedAt that is not a date at all', () => {
    return request(app.getHttpServer())
      .patch('/v1/admin/users/5')
      .set(asUser(1))
      .send({ deletedAt: 'not-a-date' })
      .expect(400)
      .expect(() => {
        expect(update).not.toHaveBeenCalled();
      });
  });

  it('403s a moderator touching deletedAt alone, same as role', () => {
    return request(app.getHttpServer())
      .patch('/v1/admin/users/5')
      .set(asUser(2))
      .send({ deletedAt: null })
      .expect(403)
      .expect(() => {
        expect(update).not.toHaveBeenCalled();
      });
  });

  it('404s a target account that does not exist, through the real Prisma filter', () => {
    update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '0.0.0',
      }),
    );

    return request(app.getHttpServer())
      .patch('/v1/admin/users/404404')
      .set(asUser(1))
      .send({ visibility: 'private' })
      .expect(404);
  });
});
