import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiPollsService } from './polls.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import type { User } from 'src/generated/prisma/client';
import { MAX_DISTRIBUTION } from '../common/schemas/api-polls.schema';

const author = { id: 7, role: 'user' } as unknown as User;
const other = { id: 8, role: 'user' } as unknown as User;
const admin = { id: 1, role: 'admin' } as unknown as User;
const moderator = { id: 2, role: 'moderator' } as unknown as User;

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
  _count: { votes: 3 },
};

const active = { ...pending, status: 'active' };

const page = { page: 1, limit: 20 };

type Queried = { where: Record<string, unknown>; skip?: number; take?: number };

describe('ApiPollsService', () => {
  let service: ApiPollsService;
  const findMany = jest.fn<Promise<unknown>, [Queried]>();
  const count = jest.fn();
  const findFirst = jest.fn<Promise<unknown>, [Queried]>();
  const create = jest.fn<
    Promise<unknown>,
    [{ data: Record<string, unknown> }]
  >();
  const update = jest.fn<
    Promise<unknown>,
    [{ data: Record<string, unknown> }]
  >();
  const transaction = jest.fn<Promise<unknown[]>, [unknown[]]>();
  const roomFindFirst = jest.fn<Promise<unknown>, [{ where: object }]>();
  const voteCount = jest.fn<Promise<number>, [{ where: object }]>();
  const voteGroupBy = jest.fn<Promise<unknown>, [Record<string, unknown>]>();
  const voteOptionGroupBy = jest.fn<Promise<unknown>, [{ where: object }]>();

  beforeEach(async () => {
    [
      findMany,
      count,
      findFirst,
      create,
      update,
      transaction,
      roomFindFirst,
      voteCount,
      voteGroupBy,
      voteOptionGroupBy,
    ].forEach((fn) => fn.mockReset());
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiPollsService,
        CaslAbilityFactory,
        {
          provide: PrismaService,
          useValue: {
            poll: { findMany, count, findFirst, create, update },
            room: { findFirst: roomFindFirst },
            vote: { count: voteCount, groupBy: voteGroupBy },
            voteOption: { groupBy: voteOptionGroupBy },
            $transaction: transaction,
          },
        },
      ],
    }).compile();

    service = module.get<ApiPollsService>(ApiPollsService);
  });

  describe('findAllPolls', () => {
    it('wraps the rows in the shared page envelope', async () => {
      transaction.mockResolvedValue([[pending], 1]);

      const answer = await service.findAllPolls(page, author);

      expect(answer).toEqual({
        data: [
          {
            id: 42,
            title: 'Best fruit',
            type: 'single_choice',
            status: 'pending',
            endsAt: new Date('2026-12-01'),
            createdBy: { id: 7, username: 'pollpear' },
            voterCount: 3,
          },
        ],
        page: 1,
        limit: 20,
        total: 1,
      });
    });

    it('counts the live votes only', async () => {
      transaction.mockResolvedValue([[], 0]);

      await service.findAllPolls(page, author);

      const { _count } = findMany.mock.calls[0][0] as unknown as {
        _count: unknown;
      };
      void _count;
      const select = (
        findMany.mock.calls[0][0] as unknown as {
          select: { _count: { select: { votes: unknown } } };
        }
      ).select;
      expect(select._count.select.votes).toEqual({
        where: { deletedAt: null },
      });
    });

    it('refuses a page larger than the role allows', async () => {
      await expect(
        service.findAllPolls({ page: 1, limit: 51 }, author),
      ).rejects.toThrow(BadRequestException);

      expect(transaction).not.toHaveBeenCalled();
    });

    it('applies the filters next to the visibility clause', async () => {
      transaction.mockResolvedValue([[], 0]);

      await service.findAllPolls({ ...page, type: 'slider' }, author);

      expect(findMany.mock.calls[0][0].where).toMatchObject({
        type: 'slider',
        deletedAt: null,
      });
    });
  });

  describe('findOnePoll', () => {
    it('answers 404 for a poll the caller may not see', async () => {
      findFirst.mockResolvedValue(null);

      await expect(service.findOnePoll(42, other)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('hands back the options it was given, and the live vote count', async () => {
      findFirst.mockResolvedValue(pending);

      const poll = await service.findOnePoll(42, author);

      expect(poll.options).toHaveLength(1);
      expect(poll.voterCount).toBe(3);
      expect(poll).not.toHaveProperty('deletedAt');
      expect(poll).not.toHaveProperty('createdById');
    });

    it('strips the author of an anonymous poll for anybody else', async () => {
      findFirst.mockResolvedValue({ ...pending, isAnonymous: true });

      const poll = await service.findOnePoll(42, other);

      expect(poll.createdBy).toBeNull();
    });
  });

  describe('createPoll', () => {
    const body = {
      title: 'Best fruit',
      type: 'single_choice' as const,
      visibility: 'public' as const,
      allowChangeVote: true,
      isAnonymous: false,
      endsAt: new Date('2026-12-01'),
      options: [
        { text: 'Pear', order: 0 },
        { text: 'Fig', order: 1 },
      ],
    };

    it('takes the author from the key and starts the poll pending', async () => {
      create.mockResolvedValue(pending);

      await service.createPoll(body, author);

      expect(create.mock.calls[0][0].data).toMatchObject({
        createdById: 7,
        status: 'pending',
      });
    });

    it('creates the options in the same statement as the poll', async () => {
      create.mockResolvedValue(pending);

      await service.createPoll(body, author);

      expect(create.mock.calls[0][0].data.options).toEqual({
        create: body.options,
      });
    });

    it('refuses to file a poll in a room the caller cannot read', async () => {
      roomFindFirst.mockResolvedValue(null);

      await expect(
        service.createPoll({ ...body, roomId: 3 }, author),
      ).rejects.toThrow(ForbiddenException);

      expect(create).not.toHaveBeenCalled();
    });

    it('accepts a room the caller may read, and asks casl which those are', async () => {
      roomFindFirst.mockResolvedValue({ id: 3 });
      create.mockResolvedValue(pending);

      await service.createPoll({ ...body, roomId: 3 }, author);

      expect(create).toHaveBeenCalled();
      expect(roomFindFirst.mock.calls[0][0]).toMatchObject({
        where: { AND: [{ id: 3 }, expect.anything()] },
      });
    });
  });

  describe('updatePoll', () => {
    it('lets the author edit a pending poll', async () => {
      findFirst.mockResolvedValue(pending);
      update.mockResolvedValue(pending);

      await service.updatePoll(42, { title: 'Best pear' }, author);

      expect(update.mock.calls[0][0].data).toEqual({ title: 'Best pear' });
    });

    it('answers 409 once the poll is published, not 403', async () => {
      findFirst.mockResolvedValue(active);

      await expect(
        service.updatePoll(42, { title: 'Best pear' }, author),
      ).rejects.toThrow(ConflictException);

      expect(update).not.toHaveBeenCalled();
    });

    it('answers 403 to somebody who does not own the poll', async () => {
      findFirst.mockResolvedValue(pending);

      await expect(
        service.updatePoll(42, { title: 'Best pear' }, other),
      ).rejects.toThrow(ForbiddenException);
    });

    it('does not let a moderator rewrite somebody elses poll', async () => {
      findFirst.mockResolvedValue(pending);

      await expect(
        service.updatePoll(42, { title: 'Best pear' }, moderator),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('removePoll', () => {
    it('soft deletes rather than dropping the row', async () => {
      findFirst.mockResolvedValue(pending);
      update.mockResolvedValue(pending);

      await service.removePoll(42, author);

      expect(update.mock.calls[0][0].data).toEqual({
        deletedAt: expect.any(Date) as Date,
      });
    });

    it('lets an admin delete a pending poll they do not own', async () => {
      findFirst.mockResolvedValue(pending);
      update.mockResolvedValue(pending);

      await service.removePoll(42, admin);

      expect(update).toHaveBeenCalled();
    });

    it('refuses to delete a poll people are voting on', async () => {
      findFirst.mockResolvedValue(active);

      await expect(service.removePoll(42, admin)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findPollResults', () => {
    const inTransaction = () =>
      transaction.mockImplementation((run: unknown) =>
        (run as (tx: unknown) => Promise<unknown[]>)({
          vote: { count: voteCount, groupBy: voteGroupBy },
          voteOption: { groupBy: voteOptionGroupBy },
        }),
      );

    const choicePoll = {
      ...pending,
      options: [
        {
          id: 1,
          text: 'Pear',
          order: 0,
          sliderLeftLabel: null,
          sliderRightLabel: null,
        },
        {
          id: 2,
          text: 'Fig',
          order: 1,
          sliderLeftLabel: null,
          sliderRightLabel: null,
        },
      ],
    };

    const sliderPoll = { ...pending, type: 'slider' };

    it('counts every option, including the one nobody picked', async () => {
      findFirst.mockResolvedValue(choicePoll);
      inTransaction();
      voteCount.mockResolvedValue(3);
      voteOptionGroupBy.mockResolvedValue([
        { optionId: 1, _count: { _all: 3 } },
      ]);

      const results = await service.findPollResults(42, author);

      expect(results).toEqual({
        type: 'single_choice',
        voters: 3,
        options: [
          { optionId: 1, text: 'Pear', voters: 3 },
          { optionId: 2, text: 'Fig', voters: 0 },
        ],
      });
    });

    it('never counts a vote that was withdrawn', async () => {
      findFirst.mockResolvedValue(choicePoll);
      inTransaction();
      voteCount.mockResolvedValue(0);
      voteOptionGroupBy.mockResolvedValue([]);

      await service.findPollResults(42, author);

      expect(voteCount.mock.calls[0][0]).toEqual({
        where: { pollId: 42, deletedAt: null },
      });
      expect(voteOptionGroupBy.mock.calls[0][0]).toMatchObject({
        where: {
          option: { pollId: 42, deletedAt: null },
          vote: { deletedAt: null },
        },
      });
    });

    it('puts a scale back in its own order, whatever postgres returned', async () => {
      findFirst.mockResolvedValue(sliderPoll);
      inTransaction();
      voteCount.mockResolvedValue(4);
      voteGroupBy.mockResolvedValue([
        { freeField: '10', _count: { _all: 1 } },
        { freeField: '2', _count: { _all: 3 } },
      ]);

      const results = await service.findPollResults(42, author);

      expect(results).toEqual({
        type: 'slider',
        voters: 4,
        average: 4,
        min: 2,
        max: 10,
        truncated: false,
        distribution: [
          { value: '2', voters: 3 },
          { value: '10', voters: 1 },
        ],
      });
    });

    it('refuses to average answers that are not all numbers', async () => {
      findFirst.mockResolvedValue(sliderPoll);
      inTransaction();
      voteCount.mockResolvedValue(2);
      voteGroupBy.mockResolvedValue([
        { freeField: '5', _count: { _all: 1 } },
        { freeField: 'beaucoup', _count: { _all: 1 } },
      ]);

      const results = await service.findPollResults(42, author);

      expect(results).toMatchObject({ average: null, min: null, max: null });
      expect(results).toHaveProperty('distribution');
    });

    it('answers nothing to average when nobody voted', async () => {
      findFirst.mockResolvedValue(sliderPoll);
      inTransaction();
      voteCount.mockResolvedValue(0);
      voteGroupBy.mockResolvedValue([]);

      expect(await service.findPollResults(42, author)).toEqual({
        type: 'slider',
        voters: 0,
        average: null,
        min: null,
        max: null,
        truncated: false,
        distribution: [],
      });
    });

    it('leaves out a tick on an option that was taken down', async () => {
      findFirst.mockResolvedValue(choicePoll);
      inTransaction();
      voteCount.mockResolvedValue(1);
      voteOptionGroupBy.mockResolvedValue([]);

      await service.findPollResults(42, author);

      expect(voteOptionGroupBy.mock.calls[0][0]).toMatchObject({
        where: { option: { deletedAt: null } },
      });
    });

    it('counts every option a voter ticked on a multiple choice poll', async () => {
      findFirst.mockResolvedValue({ ...choicePoll, type: 'multiple_choice' });
      inTransaction();
      voteCount.mockResolvedValue(2);
      voteOptionGroupBy.mockResolvedValue([
        { optionId: 1, _count: { _all: 2 } },
        { optionId: 2, _count: { _all: 1 } },
      ]);

      const results = await service.findPollResults(42, author);

      expect(results).toEqual({
        type: 'multiple_choice',
        voters: 2,
        options: [
          { optionId: 1, text: 'Pear', voters: 2 },
          { optionId: 2, text: 'Fig', voters: 1 },
        ],
      });
    });

    it('cuts a spread that would run away, and says so', async () => {
      findFirst.mockResolvedValue(sliderPoll);
      inTransaction();
      voteCount.mockResolvedValue(MAX_DISTRIBUTION + 1);
      voteGroupBy.mockResolvedValue(
        Array.from({ length: MAX_DISTRIBUTION + 1 }, (unused, index) => ({
          freeField: String(index),
          _count: { _all: 1 },
        })),
      );

      const results = await service.findPollResults(42, author);

      expect(results).toMatchObject({
        truncated: true,
        average: null,
        min: null,
        max: null,
      });
      expect(
        (results as { distribution: unknown[] }).distribution,
      ).toHaveLength(MAX_DISTRIBUTION);
    });

    it('asks the database for the answers that carry the most voters', async () => {
      findFirst.mockResolvedValue(sliderPoll);
      inTransaction();
      voteCount.mockResolvedValue(0);
      voteGroupBy.mockResolvedValue([]);

      await service.findPollResults(42, author);

      expect(voteGroupBy.mock.calls[0][0]).toMatchObject({
        orderBy: { _count: { freeField: 'desc' } },
        take: MAX_DISTRIBUTION + 1,
      });
    });

    it('never reaches a poll of a type the api does not offer', async () => {
      findFirst.mockResolvedValue(choicePoll);
      inTransaction();
      voteCount.mockResolvedValue(0);
      voteOptionGroupBy.mockResolvedValue([]);

      await service.findPollResults(42, author);

      expect(findFirst.mock.calls[0][0].where).toMatchObject({
        type: { in: ['single_choice', 'multiple_choice', 'slider'] },
      });
    });

    it('answers 404 for a poll the caller may not see', async () => {
      findFirst.mockResolvedValue(null);

      await expect(service.findPollResults(42, other)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
