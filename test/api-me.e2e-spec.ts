import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiMeController } from '../src/api/v1/me/me.controller';
import { ApiMeService } from '../src/api/v1/me/me.service';
import { CaslAbilityFactory } from '../src/casl/casl-ability.factory';
import { AuthorizationGuard } from '../src/casl/authorization.guard';
import { AuthGuard } from '../src/auth/auth.guard';
import { UsersService } from '../src/users/users.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MeService } from '../src/me/me.service';
import { Prisma, type User } from '../src/generated/prisma/client';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filters';
import { CaslExceptionFilter } from '../src/common/filters/casl-exception.filters';

describe('ApiMeController (e2e)', () => {
  let app: INestApplication<App>;

  const usersById: Record<number, User> = {
    1: { id: 1, role: 'admin' } as User,
    3: { id: 3, role: 'user' } as User,
  };

  const findByUserId = jest.fn((id: number) =>
    Promise.resolve(usersById[id] ?? null),
  );
  const findFirst = jest.fn();
  const update = jest.fn<Promise<unknown>, [{ where: object; data: object }]>();
  const remove = jest.fn();

  const owner = {
    username: 'pollpear',
    name: null,
    surname: null,
    email: 'owner@pollpear.com',
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
    isEmailVerified: true,
    visibility: 'public',
    lastSeenAt: null,
    avatarUrl: '/uploads/avatars/default.svg',
    bannerUrl: '/uploads/banners/default.svg',
    userTheme: 'light',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const ownerIsGone = new Prisma.PrismaClientKnownRequestError(
    'Record not found',
    { code: 'P2025', clientVersion: '0.0.0' },
  );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ApiMeController],
      providers: [
        ApiMeService,
        CaslAbilityFactory,
        Reflector,
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: AuthorizationGuard },
        { provide: UsersService, useValue: { findByUserId } },
        {
          provide: PrismaService,
          useValue: { user: { findFirst, update } },
        },
        { provide: MeService, useValue: { remove } },
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
    findByUserId.mockClear();
    [findFirst, update, remove].forEach((fn) => fn.mockReset());
    remove.mockResolvedValue(undefined);
  });

  const asUser = (id: number) => ({ 'x-user-id': String(id) });

  it('401s with no x-user-id header at all', () => {
    return request(app.getHttpServer()).get('/v1/me').expect(401);
  });

  it('401s an x-user-id that resolves to nobody', () => {
    return request(app.getHttpServer())
      .get('/v1/me')
      .set(asUser(404))
      .expect(401);
  });

  it('hands the owner their own profile, placeholder image included', () => {
    findFirst.mockResolvedValue(owner);

    return request(app.getHttpServer())
      .get('/v1/me')
      .set(asUser(3))
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          username: 'pollpear',
          email: 'owner@pollpear.com',
          avatarUrl: null,
          bannerUrl: null,
        });
      });
  });

  it('401s a key whose owner was deleted since', () => {
    findFirst.mockResolvedValue(null);

    return request(app.getHttpServer())
      .get('/v1/me')
      .set(asUser(3))
      .expect(401);
  });

  it('writes only the fields sent', () => {
    update.mockResolvedValue({ ...owner, bio: 'hello' });

    return request(app.getHttpServer())
      .patch('/v1/me')
      .set(asUser(3))
      .send({ bio: 'hello' })
      .expect(200)
      .expect(() => {
        expect(update.mock.calls[0][0]).toMatchObject({
          where: { id: 3, deletedAt: null },
          data: { bio: 'hello' },
        });
      });
  });

  it('400s a field the api does not expose', () => {
    return request(app.getHttpServer())
      .patch('/v1/me')
      .set(asUser(3))
      .send({ role: 'admin' })
      .expect(400)
      .expect(() => {
        expect(update).not.toHaveBeenCalled();
      });
  });

  it('400s an empty body', () => {
    return request(app.getHttpServer())
      .patch('/v1/me')
      .set(asUser(3))
      .send({})
      .expect(400);
  });

  it('401s an edit from a deleted owner, the same as a read', () => {
    update.mockRejectedValue(ownerIsGone);

    return request(app.getHttpServer())
      .patch('/v1/me')
      .set(asUser(3))
      .send({ bio: 'hello' })
      .expect(401);
  });

  it('lets a plain user close their own account', () => {
    return request(app.getHttpServer())
      .delete('/v1/me')
      .set(asUser(3))
      .expect(204)
      .expect(() => {
        expect(remove).toHaveBeenCalledWith(3);
      });
  });

  it('lets an admin close their own account too', () => {
    return request(app.getHttpServer())
      .delete('/v1/me')
      .set(asUser(1))
      .expect(204)
      .expect(() => {
        expect(remove).toHaveBeenCalledWith(1);
      });
  });
});
