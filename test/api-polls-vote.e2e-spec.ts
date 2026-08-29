import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiPollVoteController } from '../src/api/v1/polls/vote/vote.controller';
import { ApiPollVoteService } from '../src/api/v1/polls/vote/vote.service';
import { CaslAbilityFactory } from '../src/casl/casl-ability.factory';
import { AuthorizationGuard } from '../src/casl/authorization.guard';
import { AuthGuard } from '../src/auth/auth.guard';
import { UsersService } from '../src/users/users.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { type User } from '../src/generated/prisma/client';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filters';
import { CaslExceptionFilter } from '../src/common/filters/casl-exception.filters';

describe('ApiPollVoteController (e2e)', () => {
  let app: INestApplication<App>;

  const usersById: Record<number, User> = {
    7: { id: 7, role: 'user' } as User,
  };
  const findByUserId = jest.fn((id: number) =>
    Promise.resolve(usersById[id] ?? null),
  );

  const pollFindFirst = jest.fn<Promise<unknown>, [unknown]>();
  const pollUpdate = jest.fn();
  const voteFindFirst = jest.fn<Promise<unknown>, [unknown]>();
  const voteUpsert = jest.fn();
  const voteUpdate = jest.fn();
  const optionCount = jest.fn<Promise<number>, [unknown]>();

  const openPoll = {
    id: 42,
    type: 'single_choice',
    status: 'active',
    endsAt: new Date('2099-01-01'),
    deletedAt: null,
    visibility: 'public',
    createdById: 9,
    roomId: null,
    allowChangeVote: true,
    createdBy: { blocksGiven: [], blocksReceived: [] },
    room: null,
  };

  const storedVote = {
    id: 5,
    pollId: 42,
    freeField: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    voteOptions: [{ optionId: 1 }],
  };

  const ballot = { type: 'single_choice', optionIds: [1] };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ApiPollVoteController],
      providers: [
        ApiPollVoteService,
        CaslAbilityFactory,
        Reflector,
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: AuthorizationGuard },
        { provide: UsersService, useValue: { findByUserId } },
        {
          provide: PrismaService,
          useValue: {
            poll: { findFirst: pollFindFirst, update: pollUpdate },
            vote: {
              findFirst: voteFindFirst,
              upsert: voteUpsert,
              update: voteUpdate,
            },
            option: { count: optionCount },
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
      pollFindFirst,
      pollUpdate,
      voteFindFirst,
      voteUpsert,
      voteUpdate,
      optionCount,
    ].forEach((fn) => fn.mockReset());
  });

  const asUser = (id: number) => ({ 'x-user-id': String(id) });
  const post = () => request(app.getHttpServer()).post('/v1/polls/42/vote');

  it('401s a caller with no key, before any query', () =>
    post()
      .send(ballot)
      .expect(401)
      .expect(() => {
        expect(pollFindFirst).not.toHaveBeenCalled();
      }));

  it('201s a valid ballot and answers the vote', () => {
    pollFindFirst.mockResolvedValue(openPoll);
    voteFindFirst.mockResolvedValue(null);
    optionCount.mockResolvedValue(1);
    voteUpsert.mockResolvedValue(storedVote);

    return post()
      .set(asUser(7))
      .send(ballot)
      .expect(201)
      .expect((res) => {
        expect(res.body).toMatchObject({ id: 5, pollId: 42, optionIds: [1] });
      });
  });

  it('400s a ballot naming an unknown field', () => {
    pollFindFirst.mockResolvedValue(openPoll);

    return post()
      .set(asUser(7))
      .send({ ...ballot, weight: 3 })
      .expect(400);
  });

  it('400s a single choice ballot carrying two options', () => {
    pollFindFirst.mockResolvedValue(openPoll);

    return post()
      .set(asUser(7))
      .send({ type: 'single_choice', optionIds: [1, 2] })
      .expect(400);
  });

  it('404s a poll the caller may not see', () => {
    pollFindFirst.mockResolvedValue(null);

    return post().set(asUser(7)).send(ballot).expect(404);
  });

  it('403s a poll filed in a room that is no longer active', () => {
    pollFindFirst.mockResolvedValue({
      ...openPoll,
      roomId: 3,
      room: { id: 3, status: 'closed', roomMembers: [] },
    });

    return post()
      .set(asUser(7))
      .send(ballot)
      .expect(403)
      .expect(() => {
        expect(voteUpsert).not.toHaveBeenCalled();
      });
  });

  it('409s a second vote from the same caller', () => {
    pollFindFirst.mockResolvedValue(openPoll);
    optionCount.mockResolvedValue(1);
    voteFindFirst.mockResolvedValue({ id: 5 });

    return post().set(asUser(7)).send(ballot).expect(409);
  });

  it('409s a poll that forbids changing a vote', () => {
    pollFindFirst.mockResolvedValue({ ...openPoll, allowChangeVote: false });

    return request(app.getHttpServer())
      .patch('/v1/polls/42/vote')
      .set(asUser(7))
      .send(ballot)
      .expect(409);
  });

  it.each(['PATCH', 'DELETE'])(
    '409s a %s while the poll is still pending',
    (method) => {
      pollFindFirst.mockResolvedValue({ ...openPoll, status: 'pending' });

      const call =
        method === 'PATCH'
          ? request(app.getHttpServer()).patch('/v1/polls/42/vote').send(ballot)
          : request(app.getHttpServer()).delete('/v1/polls/42/vote');

      return call.set(asUser(7)).expect(409);
    },
  );

  it('400s a change that carries nothing to change', () => {
    pollFindFirst.mockResolvedValue(openPoll);

    return request(app.getHttpServer())
      .patch('/v1/polls/42/vote')
      .set(asUser(7))
      .send({ type: 'single_choice' })
      .expect(400);
  });

  it('204s a withdrawal and answers nothing', () => {
    pollFindFirst.mockResolvedValue(openPoll);
    voteFindFirst.mockResolvedValue(storedVote);
    voteUpdate.mockResolvedValue(storedVote);

    return request(app.getHttpServer())
      .delete('/v1/polls/42/vote')
      .set(asUser(7))
      .expect(204)
      .expect((res) => {
        expect(res.body).toEqual({});
      });
  });

  it('still reads the vote of a poll that is over', () => {
    pollFindFirst.mockResolvedValue({
      ...openPoll,
      status: 'closed',
      endsAt: new Date('2020-01-01'),
    });
    voteFindFirst.mockResolvedValue(storedVote);

    return request(app.getHttpServer())
      .get('/v1/polls/42/vote')
      .set(asUser(7))
      .expect(200);
  });

  it('400s an id that is not a number', () =>
    request(app.getHttpServer())
      .get('/v1/polls/abc/vote')
      .set(asUser(7))
      .expect(400));
});
