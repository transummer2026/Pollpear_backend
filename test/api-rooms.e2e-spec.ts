import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiRoomsController } from '../src/api/v1/rooms/rooms.controller';
import { ApiRoomsService } from '../src/api/v1/rooms/rooms.service';
import { CaslAbilityFactory } from '../src/casl/casl-ability.factory';
import { AuthorizationGuard } from '../src/casl/authorization.guard';
import { AuthGuard } from '../src/auth/auth.guard';
import { UsersService } from '../src/users/users.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { type User } from '../src/generated/prisma/client';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filters';
import { CaslExceptionFilter } from '../src/common/filters/casl-exception.filters';
import { LIMIT_BY_ROLE } from '../src/api/v1/common/schemas/api-pagination.schema';

describe('ApiRoomsController (e2e)', () => {
  let app: INestApplication<App>;

  const usersById: Record<number, User> = {
    1: { id: 1, role: 'admin' } as User,
    2: { id: 2, role: 'moderator' } as User,
    7: { id: 7, role: 'user' } as User,
    8: { id: 8, role: 'user' } as User,
  };

  const findByUserId = jest.fn((id: number) =>
    Promise.resolve(usersById[id] ?? null),
  );
  const findMany = jest.fn();
  const count = jest.fn();
  const findFirst = jest.fn<Promise<unknown>, [{ where: object }]>();
  const create = jest.fn<
    Promise<unknown>,
    [{ data: Record<string, unknown> }]
  >();
  const update = jest.fn<
    Promise<unknown>,
    [{ data: Record<string, unknown> }]
  >();
  const updateMany = jest.fn<
    Promise<{ count: number }>,
    [{ where: object; data: object }]
  >();
  const transaction = jest.fn();

  const activeRoom = {
    id: 42,
    name: 'Fruit lovers',
    description: null,
    bannerUrl: '/uploads/banners/default.svg',
    visibility: 'public',
    status: 'active',
    endsAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    createdById: 7,
    createdBy: { id: 7, username: 'pollpear' },
    _count: { roomMembers: 3, polls: 2 },
  };

  const closedRoom = { ...activeRoom, status: 'closed' };

  const listedRoom = {
    id: 42,
    name: 'Fruit lovers',
    bannerUrl: '/uploads/banners/default.svg',
    visibility: 'public',
    status: 'active',
    endsAt: null,
    _count: { roomMembers: 3 },
  };

  const body = { name: 'Fruit lovers', visibility: 'public' };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ApiRoomsController],
      providers: [
        ApiRoomsService,
        CaslAbilityFactory,
        Reflector,
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: AuthorizationGuard },
        { provide: UsersService, useValue: { findByUserId } },
        {
          provide: PrismaService,
          useValue: {
            room: { findMany, count, findFirst, create, update, updateMany },
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
      create,
      update,
      updateMany,
      transaction,
    ].forEach((fn) => fn.mockClear());
    updateMany.mockResolvedValue({ count: 0 });
  });

  const asUser = (id: number) => ({ 'x-user-id': String(id) });

  describe('GET /v1/rooms', () => {
    it('401s with no x-user-id header at all', () => {
      return request(app.getHttpServer()).get('/v1/rooms').expect(401);
    });

    it('answers the page envelope with the member count', () => {
      transaction.mockResolvedValue([[listedRoom], 1]);

      return request(app.getHttpServer())
        .get('/v1/rooms')
        .set(asUser(7))
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({
            data: [
              {
                id: 42,
                name: 'Fruit lovers',
                bannerUrl: '/uploads/banners/default.svg',
                visibility: 'public',
                status: 'active',
                endsAt: null,
                memberCount: 3,
              },
            ],
            page: 1,
            limit: 20,
            total: 1,
          });
        });
    });

    it('400s a query parameter nobody declared', () => {
      return request(app.getHttpServer())
        .get('/v1/rooms?sort=name')
        .set(asUser(7))
        .expect(400)
        .expect(() => {
          expect(transaction).not.toHaveBeenCalled();
        });
    });

    it('refuses a page larger than the caller role allows', () => {
      return request(app.getHttpServer())
        .get(`/v1/rooms?limit=${LIMIT_BY_ROLE.user + 1}`)
        .set(asUser(7))
        .expect(400);
    });

    it('lets a moderator ask for the same page a user is refused', () => {
      transaction.mockResolvedValue([[], 0]);

      return request(app.getHttpServer())
        .get(`/v1/rooms?limit=${LIMIT_BY_ROLE.user + 1}`)
        .set(asUser(2))
        .expect(200);
    });
  });

  describe('GET /v1/rooms/:id', () => {
    it('answers the room with both counts, and no policy column', () => {
      findFirst.mockResolvedValue(activeRoom);

      return request(app.getHttpServer())
        .get('/v1/rooms/42')
        .set(asUser(7))
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({
            id: 42,
            name: 'Fruit lovers',
            description: null,
            bannerUrl: '/uploads/banners/default.svg',
            visibility: 'public',
            status: 'active',
            endsAt: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            createdBy: { id: 7, username: 'pollpear' },
            memberCount: 3,
            pollCount: 2,
          });
        });
    });

    it('404s a room the caller may not see, exactly like a missing one', () => {
      findFirst.mockResolvedValue(null);

      return request(app.getHttpServer())
        .get('/v1/rooms/42')
        .set(asUser(8))
        .expect(404);
    });

    it('400s an id of zero, which can designate no room', () => {
      return request(app.getHttpServer())
        .get('/v1/rooms/0')
        .set(asUser(7))
        .expect(400)
        .expect(() => {
          expect(findFirst).not.toHaveBeenCalled();
        });
    });

    it('400s an id that is not a number', () => {
      return request(app.getHttpServer())
        .get('/v1/rooms/abc')
        .set(asUser(7))
        .expect(400);
    });
  });

  describe('POST /v1/rooms', () => {
    it('creates the room and answers it', () => {
      create.mockResolvedValue(activeRoom);

      return request(app.getHttpServer())
        .post('/v1/rooms')
        .set(asUser(7))
        .send(body)
        .expect(201)
        .expect(() => {
          expect(create.mock.calls[0][0].data).toMatchObject({
            status: 'active',
            createdById: 7,
          });
        });
    });

    it('400s a field nobody declared, rather than dropping it silently', () => {
      return request(app.getHttpServer())
        .post('/v1/rooms')
        .set(asUser(7))
        .send({ ...body, status: 'closed' })
        .expect(400)
        .expect(() => {
          expect(create).not.toHaveBeenCalled();
        });
    });

    it('400s an end date already past', () => {
      return request(app.getHttpServer())
        .post('/v1/rooms')
        .set(asUser(7))
        .send({ ...body, endsAt: '2020-01-01T00:00:00.000Z' })
        .expect(400);
    });
  });

  describe('PATCH /v1/rooms/:id', () => {
    it('lets the owner rename a room that is still active', () => {
      findFirst.mockResolvedValue(activeRoom);
      update.mockResolvedValue({ ...activeRoom, name: 'Renamed' });

      return request(app.getHttpServer())
        .patch('/v1/rooms/42')
        .set(asUser(7))
        .send({ name: 'Renamed' })
        .expect(200);
    });

    it('409s the owner once the room is closed', () => {
      findFirst.mockResolvedValue(closedRoom);

      return request(app.getHttpServer())
        .patch('/v1/rooms/42')
        .set(asUser(7))
        .send({ name: 'Renamed' })
        .expect(409)
        .expect(() => {
          expect(update).not.toHaveBeenCalled();
        });
    });

    it('403s somebody who does not own the room', () => {
      findFirst.mockResolvedValue(activeRoom);

      return request(app.getHttpServer())
        .patch('/v1/rooms/42')
        .set(asUser(8))
        .send({ name: 'Renamed' })
        .expect(403);
    });

    it('400s an empty body rather than writing nothing', () => {
      return request(app.getHttpServer())
        .patch('/v1/rooms/42')
        .set(asUser(7))
        .send({})
        .expect(400)
        .expect(() => {
          expect(findFirst).not.toHaveBeenCalled();
        });
    });
  });

  describe('DELETE /v1/rooms/:id', () => {
    it('answers 204 with no body once the room is gone', () => {
      findFirst.mockResolvedValue(activeRoom);
      update.mockResolvedValue({ ...activeRoom, deletedAt: new Date() });

      return request(app.getHttpServer())
        .delete('/v1/rooms/42')
        .set(asUser(7))
        .expect(204)
        .expect((res) => {
          expect(res.body).toEqual({});
          expect(update.mock.calls[0][0].data).toMatchObject({
            deletedAt: expect.any(Date) as Date,
          });
        });
    });

    it('403s somebody who does not own the room', () => {
      findFirst.mockResolvedValue(activeRoom);

      return request(app.getHttpServer())
        .delete('/v1/rooms/42')
        .set(asUser(8))
        .expect(403)
        .expect(() => {
          expect(update).not.toHaveBeenCalled();
        });
    });

    it('lets a moderator delete a room that is not theirs', () => {
      findFirst.mockResolvedValue(activeRoom);
      update.mockResolvedValue({ ...activeRoom, deletedAt: new Date() });

      return request(app.getHttpServer())
        .delete('/v1/rooms/42')
        .set(asUser(2))
        .expect(204);
    });
  });
});
