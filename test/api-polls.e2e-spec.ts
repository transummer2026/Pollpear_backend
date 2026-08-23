import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiPollsController } from '../src/api/v1/polls/polls.controller';
import { ApiPollsService } from '../src/api/v1/polls/polls.service';
import { CaslAbilityFactory } from '../src/casl/casl-ability.factory';
import { AuthorizationGuard } from '../src/casl/authorization.guard';
import { AuthGuard } from '../src/auth/auth.guard';
import { UsersService } from '../src/users/users.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { type User } from '../src/generated/prisma/client';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filters';
import { CaslExceptionFilter } from '../src/common/filters/casl-exception.filters';

describe('ApiPollsController (e2e)', () => {
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
  const findFirst = jest.fn<
    Promise<unknown>,
    [{ where: Record<string, unknown> }]
  >();
  const create = jest.fn<
    Promise<unknown>,
    [{ data: Record<string, unknown> }]
  >();
  const update = jest.fn<
    Promise<unknown>,
    [{ data: Record<string, unknown> }]
  >();
  const transaction = jest.fn();
  const voteCount = jest.fn();
  const voteGroupBy = jest.fn();
  const voteOptionGroupBy = jest.fn();
  const memberFindFirst = jest.fn();

  const pending = {
    id: 42,
    title: 'Best fruit',
    description: null,
    type: 'single_choice',
    visibility: 'public',
    allowChangeVote: true,
    isAnonymous: false,
    status: 'pending',
    publishedAt: null,
    endsAt: new Date('2026-12-01'),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    roomId: null,
    createdById: 7,
    createdBy: { id: 7, username: 'pollpear' },
    options: [
      {
        id: 1,
        text: 'Pear',
        order: 0,
        sliderLeftLabel: null,
        sliderRightLabel: null,
      },
    ],
    _count: { votes: 0 },
  };

  const active = { ...pending, status: 'active' };

  const body = {
    title: 'Best fruit',
    type: 'single_choice',
    visibility: 'public',
    allowChangeVote: true,
    isAnonymous: false,
    endsAt: '2026-12-01T00:00:00.000Z',
    options: [
      { text: 'Pear', order: 0 },
      { text: 'Fig', order: 1 },
    ],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ApiPollsController],
      providers: [
        ApiPollsService,
        CaslAbilityFactory,
        Reflector,
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: AuthorizationGuard },
        { provide: UsersService, useValue: { findByUserId } },
        {
          provide: PrismaService,
          useValue: {
            poll: { findMany, count, findFirst, create, update },
            roomMember: { findFirst: memberFindFirst },
            vote: { count: voteCount, groupBy: voteGroupBy },
            voteOption: { groupBy: voteOptionGroupBy },
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
    findByUserId.mockClear();
    [
      findMany,
      count,
      findFirst,
      create,
      update,
      transaction,
      memberFindFirst,
      voteCount,
      voteGroupBy,
      voteOptionGroupBy,
    ].forEach((fn) => fn.mockReset());
    transaction.mockResolvedValue([[], 0]);
    create.mockResolvedValue(pending);
    update.mockResolvedValue(pending);
  });

  const asUser = (id: number) => ({ 'x-user-id': String(id) });

  describe('GET /v1/polls', () => {
    it('401s with no x-user-id header at all', () => {
      return request(app.getHttpServer()).get('/v1/polls').expect(401);
    });

    it('answers the page envelope', () => {
      transaction.mockResolvedValue([[pending], 1]);

      return request(app.getHttpServer())
        .get('/v1/polls')
        .set(asUser(7))
        .expect(200)
        .expect((res) => {
          expect(res.body).toMatchObject({ page: 1, limit: 20, total: 1 });
        });
    });

    it('accepts the documented filters', () => {
      return request(app.getHttpServer())
        .get('/v1/polls?type=slider&status=active&createdBy=7&hashtag=fruit')
        .set(asUser(7))
        .expect(200);
    });

    it('400s a filter value outside the enum', () => {
      return request(app.getHttpServer())
        .get('/v1/polls?type=telepathy')
        .set(asUser(7))
        .expect(400);
    });

    it('400s a parameter nobody declared', () => {
      return request(app.getHttpServer())
        .get('/v1/polls?sort=title')
        .set(asUser(7))
        .expect(400);
    });

    it('400s a page larger than the caller role allows', () => {
      return request(app.getHttpServer())
        .get('/v1/polls?limit=51')
        .set(asUser(7))
        .expect(400);
    });
  });

  describe('POST /v1/polls', () => {
    it('creates the poll for the key owner', () => {
      return request(app.getHttpServer())
        .post('/v1/polls')
        .set(asUser(7))
        .send(body)
        .expect(201)
        .expect(() => {
          expect(create.mock.calls[0][0].data).toMatchObject({
            createdById: 7,
            status: 'pending',
          });
        });
    });

    it('400s a body that tries to name the author itself', () => {
      return request(app.getHttpServer())
        .post('/v1/polls')
        .set(asUser(7))
        .send({ ...body, createdById: 1 })
        .expect(400)
        .expect(() => {
          expect(create).not.toHaveBeenCalled();
        });
    });

    it('400s a choice poll with a single option', () => {
      return request(app.getHttpServer())
        .post('/v1/polls')
        .set(asUser(7))
        .send({ ...body, options: [{ text: 'Pear', order: 0 }] })
        .expect(400);
    });

    it('400s two options sharing one position', () => {
      return request(app.getHttpServer())
        .post('/v1/polls')
        .set(asUser(7))
        .send({
          ...body,
          options: [
            { text: 'Pear', order: 0 },
            { text: 'Fig', order: 0 },
          ],
        })
        .expect(400);
    });

    it('400s a free field poll carrying options', () => {
      return request(app.getHttpServer())
        .post('/v1/polls')
        .set(asUser(7))
        .send({ ...body, type: 'free_field' })
        .expect(400);
    });
  });

  describe('GET /v1/polls/:id', () => {
    it('404s a poll the caller may not see', () => {
      findFirst.mockResolvedValue(null);

      return request(app.getHttpServer())
        .get('/v1/polls/42')
        .set(asUser(8))
        .expect(404);
    });

    it('400s an id of zero before touching the database', () => {
      return request(app.getHttpServer())
        .get('/v1/polls/0')
        .set(asUser(7))
        .expect(400)
        .expect(() => {
          expect(findFirst).not.toHaveBeenCalled();
        });
    });

    it('hides the author of an anonymous poll', () => {
      findFirst.mockResolvedValue({ ...pending, isAnonymous: true });

      return request(app.getHttpServer())
        .get('/v1/polls/42')
        .set(asUser(8))
        .expect(200)
        .expect((res) => {
          expect(res.body).toMatchObject({ createdBy: null });
        });
    });
  });

  describe('PATCH /v1/polls/:id', () => {
    it('lets the author edit a pending poll', () => {
      findFirst.mockResolvedValue(pending);

      return request(app.getHttpServer())
        .patch('/v1/polls/42')
        .set(asUser(7))
        .send({ title: 'Best pear' })
        .expect(200);
    });

    it('403s somebody who does not own the poll', () => {
      findFirst.mockResolvedValue(pending);

      return request(app.getHttpServer())
        .patch('/v1/polls/42')
        .set(asUser(8))
        .send({ title: 'Best pear' })
        .expect(403)
        .expect(() => {
          expect(update).not.toHaveBeenCalled();
        });
    });

    it('409s the author once voting has started', () => {
      findFirst.mockResolvedValue(active);

      return request(app.getHttpServer())
        .patch('/v1/polls/42')
        .set(asUser(7))
        .send({ title: 'Best pear' })
        .expect(409);
    });

    it('400s an empty body', () => {
      return request(app.getHttpServer())
        .patch('/v1/polls/42')
        .set(asUser(7))
        .send({})
        .expect(400);
    });
  });

  describe('DELETE /v1/polls/:id', () => {
    it('lets the author delete a pending poll, without dropping the row', () => {
      findFirst.mockResolvedValue(pending);

      return request(app.getHttpServer())
        .delete('/v1/polls/42')
        .set(asUser(7))
        .expect(204)
        .expect(() => {
          expect(update.mock.calls[0][0].data).toEqual({
            deletedAt: expect.any(Date) as Date,
          });
        });
    });

    it('lets an admin delete a pending poll they do not own', () => {
      findFirst.mockResolvedValue(pending);

      return request(app.getHttpServer())
        .delete('/v1/polls/42')
        .set(asUser(1))
        .expect(204);
    });

    it('403s a plain user deleting somebody elses poll', () => {
      findFirst.mockResolvedValue(pending);

      return request(app.getHttpServer())
        .delete('/v1/polls/42')
        .set(asUser(8))
        .expect(403);
    });

    it('403s a moderator: moderating a poll is not deleting it', () => {
      findFirst.mockResolvedValue(pending);

      return request(app.getHttpServer())
        .delete('/v1/polls/42')
        .set(asUser(2))
        .expect(403);
    });

    it('409s once people have started voting, admin included', () => {
      findFirst.mockResolvedValue(active);

      return request(app.getHttpServer())
        .delete('/v1/polls/42')
        .set(asUser(1))
        .expect(409);
    });
  });

  describe('GET /v1/polls/:id/results', () => {
    const inTransaction = () =>
      transaction.mockImplementation((run: unknown) =>
        (run as (tx: unknown) => Promise<unknown[]>)({
          vote: { count: voteCount, groupBy: voteGroupBy },
          voteOption: { groupBy: voteOptionGroupBy },
        }),
      );

    it('tallies a choice poll option by option', () => {
      findFirst.mockResolvedValue(pending);
      inTransaction();
      voteCount.mockResolvedValue(2);
      voteOptionGroupBy.mockResolvedValue([
        { optionId: 1, _count: { _all: 2 } },
      ]);

      return request(app.getHttpServer())
        .get('/v1/polls/42/results')
        .set(asUser(7))
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({
            type: 'single_choice',
            voters: 2,
            options: [{ optionId: 1, text: 'Pear', voters: 2 }],
          });
        });
    });

    it('names no voter, ever', () => {
      findFirst.mockResolvedValue({ ...pending, isAnonymous: false });
      inTransaction();
      voteCount.mockResolvedValue(1);
      voteOptionGroupBy.mockResolvedValue([
        { optionId: 1, _count: { _all: 1 } },
      ]);

      return request(app.getHttpServer())
        .get('/v1/polls/42/results')
        .set(asUser(8))
        .expect(200)
        .expect((res) => {
          const body = res.body as Record<string, unknown>;
          expect(Object.keys(body).sort()).toEqual([
            'options',
            'type',
            'voters',
          ]);
          expect(JSON.stringify(body)).not.toMatch(
            /createdBy|username|email|createdById/i,
          );
        });
    });

    it('404s a poll the caller may not see', () => {
      findFirst.mockResolvedValue(null);

      return request(app.getHttpServer())
        .get('/v1/polls/42/results')
        .set(asUser(8))
        .expect(404);
    });

    it('asks the database only for the types the api offers', () => {
      findFirst.mockResolvedValue(pending);
      inTransaction();
      voteCount.mockResolvedValue(0);
      voteOptionGroupBy.mockResolvedValue([]);

      return request(app.getHttpServer())
        .get('/v1/polls/42/results')
        .set(asUser(7))
        .expect(200)
        .expect(() => {
          expect(findFirst.mock.calls[0][0].where).toMatchObject({
            type: { in: ['single_choice', 'multiple_choice', 'slider'] },
          });
        });
    });

    it('401s without an identity, before touching the database', () => {
      return request(app.getHttpServer())
        .get('/v1/polls/42/results')
        .expect(401)
        .expect(() => {
          expect(findFirst).not.toHaveBeenCalled();
        });
    });
  });
});
