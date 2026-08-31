import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiFriendshipsController } from '../src/api/v1/friendships/friendships.controller';
import { ApiFriendshipsService } from '../src/api/v1/friendships/friendships.service';
import { CaslAbilityFactory } from '../src/casl/casl-ability.factory';
import { AuthorizationGuard } from '../src/casl/authorization.guard';
import { AuthGuard } from '../src/auth/auth.guard';
import { UsersService } from '../src/users/users.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotificationService } from '../src/notification/notification.service';
import { type User } from '../src/generated/prisma/client';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filters';
import { CaslExceptionFilter } from '../src/common/filters/casl-exception.filters';

describe('ApiFriendshipsController (e2e)', () => {
  let app: INestApplication<App>;

  const usersById: Record<number, User> = {
    4: { id: 4, role: 'user' } as User,
    9: { id: 9, role: 'user' } as User,
  };

  const findByUserId = jest.fn((id: number) =>
    Promise.resolve(usersById[id] ?? null),
  );
  const findMany = jest.fn();
  const count = jest.fn();
  const findFirst = jest.fn<Promise<unknown>, [{ where: object }]>();
  const findUnique = jest.fn<Promise<unknown>, [{ where: object }]>();
  const upsert = jest.fn<Promise<unknown>, [Record<string, unknown>]>();
  const update = jest.fn<Promise<unknown>, [{ data: object }]>();
  const updateMany = jest.fn();
  const userFindFirst = jest.fn<Promise<unknown>, [{ where: object }]>();
  const transaction = jest.fn();
  const notify = () => jest.fn().mockResolvedValue(undefined);

  const stored = {
    id: 1,
    status: 'pending',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    userAId: 4,
    userBId: 9,
    addresseeId: 9,
    userA: { id: 4, username: 'anna' },
    userB: { id: 9, username: 'bob' },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ApiFriendshipsController],
      providers: [
        ApiFriendshipsService,
        CaslAbilityFactory,
        Reflector,
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: AuthorizationGuard },
        { provide: UsersService, useValue: { findByUserId } },
        {
          provide: NotificationService,
          useValue: {
            notifyFriendRequest: notify(),
            notifyFriendAccepted: notify(),
            clearFriendRequest: notify(),
            clearFriendNotifications: notify(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            friendship: {
              findMany,
              count,
              findFirst,
              findUnique,
              upsert,
              update,
              updateMany,
            },
            user: { findFirst: userFindFirst },
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
    [
      findByUserId,
      findMany,
      count,
      findFirst,
      findUnique,
      upsert,
      update,
      updateMany,
      userFindFirst,
      transaction,
    ].forEach((fn) => fn.mockClear());
    userFindFirst.mockResolvedValue({ id: 9 });
  });

  const asUser = (id: number) => ({ 'x-user-id': String(id) });

  it('401s with no x-user-id header at all', () =>
    request(app.getHttpServer()).get('/v1/friendships').expect(401));

  it('answers the page envelope, naming the parties by their role', () => {
    transaction.mockResolvedValue([[stored], 1]);

    return request(app.getHttpServer())
      .get('/v1/friendships')
      .set(asUser(4))
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          data: [
            {
              id: 1,
              status: 'pending',
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              requester: { id: 4, username: 'anna' },
              addressee: { id: 9, username: 'bob' },
            },
          ],
          page: 1,
          limit: 20,
          total: 1,
        });
      });
  });

  it('400s a query parameter nobody declared', () =>
    request(app.getHttpServer())
      .get('/v1/friendships?sort=id')
      .set(asUser(4))
      .expect(400));

  it('creates a request and answers it', () => {
    findUnique.mockResolvedValue(null);
    upsert.mockResolvedValue(stored);

    return request(app.getHttpServer())
      .post('/v1/friendships')
      .set(asUser(4))
      .send({ addresseeId: 9 })
      .expect(201);
  });

  it('400s befriending yourself', () =>
    request(app.getHttpServer())
      .post('/v1/friendships')
      .set(asUser(4))
      .send({ addresseeId: 4 })
      .expect(400));

  it('400s a field nobody declared, rather than dropping it silently', () =>
    request(app.getHttpServer())
      .post('/v1/friendships')
      .set(asUser(4))
      .send({ addresseeId: 9, status: 'accepted' })
      .expect(400));

  it('409s a friendship that already stands', () => {
    findUnique.mockResolvedValue({ ...stored, status: 'accepted' });

    return request(app.getHttpServer())
      .post('/v1/friendships')
      .set(asUser(4))
      .send({ addresseeId: 9 })
      .expect(409);
  });

  it('lets the addressee answer, and refuses the requester', async () => {
    findFirst.mockResolvedValue(stored);
    updateMany.mockResolvedValue({ count: 1 });

    await request(app.getHttpServer())
      .patch('/v1/friendships/1')
      .set(asUser(9))
      .send({ status: 'accepted' })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/v1/friendships/1')
      .set(asUser(4))
      .send({ status: 'accepted' })
      .expect(403);
  });

  it('400s a status the contract does not offer', () => {
    findFirst.mockResolvedValue(stored);

    return request(app.getHttpServer())
      .patch('/v1/friendships/1')
      .set(asUser(9))
      .send({ status: 'pending' })
      .expect(400);
  });

  it('answers 204 with no body once withdrawn', () => {
    findFirst.mockResolvedValue(stored);
    update.mockResolvedValue({ ...stored, deletedAt: new Date() });

    return request(app.getHttpServer())
      .delete('/v1/friendships/1')
      .set(asUser(4))
      .expect(204)
      .expect((res) => {
        expect(res.body).toEqual({});
      });
  });

  it('404s one the caller may not see, exactly like a missing one', () => {
    findFirst.mockResolvedValue(null);

    return request(app.getHttpServer())
      .get('/v1/friendships/1')
      .set(asUser(4))
      .expect(404);
  });

  it('400s an id of zero, which can designate no friendship', () =>
    request(app.getHttpServer())
      .get('/v1/friendships/0')
      .set(asUser(4))
      .expect(400));
});
