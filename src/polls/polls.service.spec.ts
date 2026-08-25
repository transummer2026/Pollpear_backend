import { ForbiddenError } from '@casl/ability';
import { Logger } from '@nestjs/common';
import {
  PollCreateDTO,
  PollReadSchema,
  PollUpdateDTO,
} from 'Pollpear_shared/src/schemas/polls.schema';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { HashtagsService } from 'src/hashtags/hashtags.service';
import { OptionsService } from 'src/options/options.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PollsService } from './polls.service';

function author(overrides: Record<string, unknown> = {}) {
  return { id: 42, role: 'user', ...overrides };
}

function pendingPoll(overrides: Record<string, unknown> = {}) {
  return { id: 7, status: 'pending', createdById: 42, ...overrides };
}

function createBody(overrides: Record<string, unknown> = {}): PollCreateDTO {
  return {
    title: 'Best pear variety?',
    type: 'multiple_choice',
    endsAt: new Date('2030-01-01'),
    allowChangeVote: true,
    isAnonymous: false,
    options: [
      { text: 'Comice', order: 0 },
      { text: 'Conference', order: 1 },
    ],
    ...overrides,
  } as unknown as PollCreateDTO;
}

function updateBody(): PollUpdateDTO {
  return {
    type: 'multiple_choice',
    title: 'Renamed',
    options: [
      { id: 1, text: 'Comice', order: 0 },
      { text: 'Williams', order: 1 },
    ],
    hashtags: [{ name: 'dev' }],
  };
}

/**
 * A single vote row, defaulted to belong to poll 7 and user 42. `freeField`
 * only matters for slider polls — it holds the numeric value the voter chose.
 */
function makeVote(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    freeField: null as string | null,
    createdById: 42,
    pollId: 7,
    ...overrides,
  };
}

/**
 * A poll fixture with only the fields `shapePollForUser` (exercised via
 * `findMeOnePoll`/`findMeManyPolls`) actually reads: `type`, `isAnonymous`,
 * `createdBy`, `votes`. `PollReadSchema.parse` is stubbed below, so this
 * doesn't need to satisfy the full Prisma-generated schema.
 */
function makePoll(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    type: 'multiple_choice',
    isAnonymous: false,
    createdBy: { id: 1, name: 'Author' },
    votes: [] as ReturnType<typeof makeVote>[],
    ...overrides,
  };
}

describe('PollsService', () => {
  const pollCreate = jest.fn();
  const pollUpdate = jest.fn();
  const pollFindMany = jest.fn();
  const pollFindFirstOrThrow = jest.fn();
  const pollFindUniqueOrThrow = jest.fn();
  const userFindUniqueOrThrow = jest.fn();
  const voteFindUnique = jest.fn();
  const voteFindMany = jest.fn();
  const prisma = {
    poll: {
      create: pollCreate,
      update: pollUpdate,
      findMany: pollFindMany,
      findFirstOrThrow: pollFindFirstOrThrow,
      findUniqueOrThrow: pollFindUniqueOrThrow,
    },
    user: { findUniqueOrThrow: userFindUniqueOrThrow },
    vote: { findUnique: voteFindUnique, findMany: voteFindMany },
  } as unknown as PrismaService;
  const buildOptionsNestedWrite = jest.fn();
  const buildHashtagsNestedWrite = jest.fn();
  const resolveHashtag = jest.fn();
  const service = new PollsService(
    prisma,
    new CaslAbilityFactory(),
    { buildOptionsNestedWrite } as unknown as OptionsService,
    {
      resolveHashtag,
      buildHashtagsNestedWrite,
    } as unknown as HashtagsService,
    {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
      debug: jest.fn(),
    } as unknown as Logger,
  );

  // `findMeOnePoll`/`findMeManyPolls` run their assembled poll through
  // `PollReadSchema.parse`, which enforces the full Prisma-generated shape.
  // These tests care about the service's own logic (hasVoted/voterCount/
  // sliderResult/anonymization), not re-validating that shared schema, so
  // `parse` is stubbed to just return whatever it's given.
  jest
    .spyOn(PollReadSchema, 'parse')
    .mockImplementation(
      (value) => value as ReturnType<typeof PollReadSchema.parse>,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('forces private visibility, pending status and the caller as owner', async () => {
      userFindUniqueOrThrow.mockResolvedValue(author());
      const body = createBody({
        visibility: 'public',
        status: 'active',
        createdById: 999,
      });

      await service.create(42, body);

      expect(pollCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          visibility: 'private',
          status: 'pending',
          createdById: 42,
        }) as object,
      });
    });

    it('nests option rows and resolved hashtag ids', async () => {
      userFindUniqueOrThrow.mockResolvedValue(author());
      resolveHashtag
        .mockResolvedValueOnce({ hashtagId: 1 })
        .mockResolvedValueOnce({ hashtagId: 2 });
      const body = createBody({
        hashtags: [{ name: 'dev' }, { name: 'life' }],
      });

      await service.create(42, body);

      expect(resolveHashtag).toHaveBeenNthCalledWith(
        1,
        'dev',
        expect.anything(),
      );
      expect(resolveHashtag).toHaveBeenNthCalledWith(
        2,
        'life',
        expect.anything(),
      );
      expect(pollCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          options: { create: body.options },
          pollHashtags: { create: [{ hashtagId: 1 }, { hashtagId: 2 }] },
        }) as object,
      });
    });

    it('skips hashtag resolution when the body carries none', async () => {
      userFindUniqueOrThrow.mockResolvedValue(author());

      await service.create(42, createBody());

      expect(resolveHashtag).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('refuses an update from anyone but the author', async () => {
      userFindUniqueOrThrow.mockResolvedValue(author({ id: 43 }));
      pollFindFirstOrThrow.mockResolvedValue(pendingPoll());

      await expect(service.update(7, 43, updateBody())).rejects.toThrow(
        ForbiddenError,
      );
      expect(pollUpdate).not.toHaveBeenCalled();
    });

    it('refuses an update once the poll left the pending status', async () => {
      userFindUniqueOrThrow.mockResolvedValue(author());
      pollFindFirstOrThrow.mockResolvedValue(pendingPoll({ status: 'active' }));

      await expect(service.update(7, 42, updateBody())).rejects.toThrow(
        ForbiddenError,
      );
    });

    it('lets the author update a pending poll and strips the type discriminant', async () => {
      userFindUniqueOrThrow.mockResolvedValue(author());
      pollFindFirstOrThrow.mockResolvedValue(pendingPoll());
      const optionsWrite = { create: [] };
      const hashtagsWrite = { deleteMany: [] };
      buildOptionsNestedWrite.mockResolvedValue(optionsWrite);
      buildHashtagsNestedWrite.mockResolvedValue(hashtagsWrite);
      const body = updateBody();

      await service.update(7, 42, body);

      expect(buildOptionsNestedWrite).toHaveBeenCalledWith(7, body.options);
      expect(buildHashtagsNestedWrite).toHaveBeenCalledWith(
        7,
        body.hashtags,
        expect.anything(),
      );
      expect(pollUpdate).toHaveBeenCalledWith({
        where: { id: 7, endsAt: { gte: expect.any(Date) as Date } },
        data: {
          title: 'Renamed',
          options: optionsWrite,
          pollHashtags: hashtagsWrite,
        },
      });
    });
  });

  describe('remove', () => {
    it('refuses a removal from anyone but the author', async () => {
      userFindUniqueOrThrow.mockResolvedValue(author({ id: 43 }));
      pollFindFirstOrThrow.mockResolvedValue(pendingPoll());

      await expect(service.remove(7, 43)).rejects.toThrow(ForbiddenError);
      expect(pollUpdate).not.toHaveBeenCalled();
    });

    it('refuses to remove a poll that left the pending status', async () => {
      userFindUniqueOrThrow.mockResolvedValue(author());
      pollFindFirstOrThrow.mockResolvedValue(pendingPoll({ status: 'active' }));

      await expect(service.remove(7, 42)).rejects.toThrow(ForbiddenError);
    });

    it('soft-deletes a pending poll for its author', async () => {
      userFindUniqueOrThrow.mockResolvedValue(author());
      pollFindFirstOrThrow.mockResolvedValue(pendingPoll());

      await service.remove(7, 42);

      expect(pollFindFirstOrThrow).toHaveBeenCalledWith({
        where: { id: 7, deletedAt: null },
      });
      expect(pollUpdate).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { deletedAt: expect.any(Date) as Date },
      });
    });
  });

  describe('findMeOnePoll', () => {
    it('reports hasVoted true when the requesting user has a vote on record', async () => {
      pollFindUniqueOrThrow.mockResolvedValue(makePoll());
      voteFindUnique.mockResolvedValue(makeVote());

      const result = await service.findMeOnePoll(7, 42);

      expect(result.hasVoted).toBe(true);
    });

    it('reports hasVoted false when the lookup finds no vote', async () => {
      pollFindUniqueOrThrow.mockResolvedValue(makePoll());
      voteFindUnique.mockResolvedValue(null);

      const result = await service.findMeOnePoll(7, 42);

      expect(result.hasVoted).toBe(false);
    });

    it("counts every vote on the poll, not just the requesting user's", async () => {
      pollFindUniqueOrThrow.mockResolvedValue(
        makePoll({
          votes: [makeVote({ id: 1 }), makeVote({ id: 2, createdById: 99 })],
        }),
      );
      voteFindUnique.mockResolvedValue(null);

      const result = await service.findMeOnePoll(7, 42);

      expect(result.voterCount).toBe(2);
    });

    it('averages slider votes into a 0-1 sliderResult', async () => {
      pollFindUniqueOrThrow.mockResolvedValue(
        makePoll({
          type: 'slider',
          votes: [makeVote({ freeField: '80' }), makeVote({ freeField: '40' })],
        }),
      );
      voteFindUnique.mockResolvedValue(null);

      const result = await service.findMeOnePoll(7, 42);

      // (80 + 40) / 2 votes / 100 = 0.6
      expect(result.sliderResult).toBeCloseTo(0.6);
    });

    it('leaves sliderResult at 0 for non-slider polls, even if freeField is set', async () => {
      pollFindUniqueOrThrow.mockResolvedValue(
        makePoll({
          type: 'multiple_choice',
          votes: [makeVote({ freeField: '80' })],
        }),
      );
      voteFindUnique.mockResolvedValue(null);

      const result = await service.findMeOnePoll(7, 42);

      expect(result.sliderResult).toBe(0);
    });

    it('leaves sliderResult at 0 for a slider poll with no votes yet', async () => {
      pollFindUniqueOrThrow.mockResolvedValue(
        makePoll({ type: 'slider', votes: [] }),
      );
      voteFindUnique.mockResolvedValue(null);

      const result = await service.findMeOnePoll(7, 42);

      expect(result.sliderResult).toBe(0);
    });

    it('hides the author on an anonymous poll', async () => {
      pollFindUniqueOrThrow.mockResolvedValue(makePoll({ isAnonymous: true }));
      voteFindUnique.mockResolvedValue(null);

      const result = await service.findMeOnePoll(7, 42);

      expect(result.createdBy).toBeNull();
    });

    it('keeps the author on a non-anonymous poll', async () => {
      const author = { id: 1, name: 'Author' };
      pollFindUniqueOrThrow.mockResolvedValue(
        makePoll({ isAnonymous: false, createdBy: author }),
      );
      voteFindUnique.mockResolvedValue(null);

      const result = await service.findMeOnePoll(7, 42);

      expect(result.createdBy).toBe(author);
    });
  });

  describe('findMeManyPolls', () => {
    it('matches hasVoted per poll from the bulk vote list', async () => {
      pollFindMany.mockResolvedValue([
        makePoll({ id: 1 }),
        makePoll({ id: 2 }),
      ]);
      voteFindMany.mockResolvedValue([makeVote({ pollId: 2 })]);

      const [pollOne, pollTwo] = (await service.findMeManyPolls(42)) as Array<{
        hasVoted: boolean;
      }>;

      expect(pollOne.hasVoted).toBe(false);
      expect(pollTwo.hasVoted).toBe(true);
    });

    it('computes voterCount and sliderResult independently per poll', async () => {
      pollFindMany.mockResolvedValue([
        makePoll({
          id: 1,
          type: 'slider',
          votes: [
            makeVote({ pollId: 1, freeField: '100' }),
            makeVote({ pollId: 1, freeField: '0' }),
          ],
        }),
        makePoll({
          id: 2,
          type: 'multiple_choice',
          votes: [makeVote({ pollId: 2 })],
        }),
      ]);
      voteFindMany.mockResolvedValue([]);

      const [sliderPoll, choicePoll] = (await service.findMeManyPolls(
        42,
      )) as Array<{
        voterCount: number;
        sliderResult: number;
      }>;

      expect(sliderPoll.voterCount).toBe(2);
      expect(sliderPoll.sliderResult).toBeCloseTo(0.5);
      expect(choicePoll.voterCount).toBe(1);
      expect(choicePoll.sliderResult).toBe(0);
    });
  });
});
