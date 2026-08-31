import { ForbiddenError } from '@casl/ability';
import { Logger, NotFoundException } from '@nestjs/common';
import {
  PollCreateDTO,
  PollReadSchema,
  PollUpdateDTO,
} from 'Pollpear_shared/src/schemas/polls.schema';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { accessibleBy } from 'src/casl/casl-prisma';
import { HashtagsService } from 'src/hashtags/hashtags.service';
import { OptionsService } from 'src/options/options.service';
import { PrismaService } from 'src/prisma/prisma.service';
import type { User } from 'src/generated/prisma/client';
import { PollsService } from './polls.service';

function author(overrides: Record<string, unknown> = {}) {
  return { id: 42, role: 'user', ...overrides };
}

/** A full-shaped `User` for the given id — what `@CurrentUser()` now hands
 * the service, in place of a bare id. */
function viewer(overrides: Record<string, unknown> = {}): User {
  return author(overrides) as User;
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
  const pollFindFirst = jest.fn();
  const voteFindUnique = jest.fn();
  const voteFindMany = jest.fn();
  const roomFindFirst = jest.fn();
  const roomUpdateMany = jest.fn();
  const prisma = {
    poll: {
      create: pollCreate,
      update: pollUpdate,
      findMany: pollFindMany,
      findFirst: pollFindFirst,
    },
    vote: { findUnique: voteFindUnique, findMany: voteFindMany },
    room: { findFirst: roomFindFirst, updateMany: roomUpdateMany },
  } as unknown as PrismaService;
  const buildOptionsNestedWrite = jest.fn();
  const buildHashtagsNestedWrite = jest.fn();
  const resolveHashtag = jest.fn();
  const abilityFactory = new CaslAbilityFactory();
  const service = new PollsService(
    prisma,
    abilityFactory,
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

  // Rooms are fetched scoped to the CASL room-read policy; rather than
  // re-typing its conditions, derive the expected `where` the same way the
  // service does — run the real ability through `accessibleBy`.
  function readableRoomWhere(v: User) {
    return accessibleBy(abilityFactory.createForUser(v), 'read').ofType('Room');
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('carries the caller-chosen visibility, forces pending status and the caller as owner', async () => {
      const body = createBody({
        visibility: 'private',
        status: 'active',
        createdById: 999,
      });

      await service.create(viewer(), body);

      expect(pollCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          visibility: 'private',
          status: 'pending',
          createdById: 42,
        }) as object,
      });
    });

    it('defaults a poll to public visibility', async () => {
      await service.create(viewer(), createBody({ visibility: 'public' }));

      expect(pollCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ visibility: 'public' }) as object,
      });
    });

    it('nests option rows and resolved hashtag ids', async () => {
      resolveHashtag
        .mockResolvedValueOnce({ hashtagId: 1 })
        .mockResolvedValueOnce({ hashtagId: 2 });
      const body = createBody({
        hashtags: [{ name: 'dev' }, { name: 'life' }],
      });

      await service.create(viewer(), body);

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
      await service.create(viewer(), createBody());

      expect(resolveHashtag).not.toHaveBeenCalled();
    });

    describe('room-scoped poll', () => {
      const memberRoom = (overrides: Record<string, unknown> = {}) => ({
        id: 1,
        status: 'active',
        endsAt: null,
        deletedAt: null,
        roomMembers: [{ userId: 42, deletedAt: null }],
        ...overrides,
      });

      it('creates the poll when the target room is active and the caller is a member', async () => {
        roomFindFirst.mockResolvedValue(memberRoom());

        const caller = viewer();
        await service.create(caller, createBody({ roomId: 1 }));

        expect(roomFindFirst).toHaveBeenCalledWith({
          where: {
            AND: [readableRoomWhere(caller), { id: 1, deletedAt: null }],
          },
          include: { roomMembers: true },
        });
        expect(pollCreate).toHaveBeenCalled();
      });

      it('rejects the poll when the caller is not a member of the target room', async () => {
        roomFindFirst.mockResolvedValue(
          memberRoom({ roomMembers: [{ userId: 99, deletedAt: null }] }),
        );

        await expect(
          service.create(viewer(), createBody({ roomId: 1 })),
        ).rejects.toThrow(ForbiddenError);
        expect(pollCreate).not.toHaveBeenCalled();
      });

      it('rejects the poll when the target room is closed', async () => {
        roomFindFirst.mockResolvedValue(memberRoom({ status: 'closed' }));

        await expect(
          service.create(viewer(), createBody({ roomId: 1 })),
        ).rejects.toThrow(ForbiddenError);
        expect(pollCreate).not.toHaveBeenCalled();
      });

      it('rejects the poll when the target room has passed its endsAt, flipping it closed', async () => {
        roomFindFirst.mockResolvedValue(
          memberRoom({ endsAt: new Date(Date.now() - 1_000) }),
        );

        await expect(
          service.create(viewer(), createBody({ roomId: 1 })),
        ).rejects.toThrow(ForbiddenError);
        expect(roomUpdateMany).toHaveBeenCalledWith({
          where: { id: { in: [1] }, status: 'active' },
          data: { status: 'closed' },
        });
        expect(pollCreate).not.toHaveBeenCalled();
      });

      it('404s when the target room does not exist', async () => {
        roomFindFirst.mockResolvedValue(null);

        await expect(
          service.create(viewer(), createBody({ roomId: 1 })),
        ).rejects.toThrow(NotFoundException);
        expect(pollCreate).not.toHaveBeenCalled();
      });
    });
  });

  describe('update', () => {
    it('refuses an update from anyone but the author', async () => {
      pollFindFirst.mockResolvedValue(pendingPoll());

      await expect(
        service.update(7, viewer({ id: 43 }), updateBody()),
      ).rejects.toThrow(ForbiddenError);
      expect(pollUpdate).not.toHaveBeenCalled();
    });

    it('refuses an update once the poll left the pending status', async () => {
      pollFindFirst.mockResolvedValue(pendingPoll({ status: 'active' }));

      await expect(service.update(7, viewer(), updateBody())).rejects.toThrow(
        ForbiddenError,
      );
    });

    it('lets the author update a pending poll and strips the type discriminant', async () => {
      pollFindFirst.mockResolvedValue(pendingPoll());
      const optionsWrite = { create: [] };
      const hashtagsWrite = { deleteMany: [] };
      buildOptionsNestedWrite.mockResolvedValue(optionsWrite);
      buildHashtagsNestedWrite.mockResolvedValue(hashtagsWrite);
      const body = updateBody();

      await service.update(7, viewer(), body);

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
      pollFindFirst.mockResolvedValue(pendingPoll());

      await expect(service.remove(7, viewer({ id: 43 }))).rejects.toThrow(
        ForbiddenError,
      );
      expect(pollUpdate).not.toHaveBeenCalled();
    });

    it('refuses to remove a poll that left the pending status', async () => {
      pollFindFirst.mockResolvedValue(pendingPoll({ status: 'active' }));

      await expect(service.remove(7, viewer())).rejects.toThrow(ForbiddenError);
    });

    it('soft-deletes a pending poll for its author', async () => {
      pollFindFirst.mockResolvedValue(pendingPoll());

      await service.remove(7, viewer());

      expect(pollFindFirst).toHaveBeenCalledWith({
        where: { id: 7, deletedAt: null },
      });
      expect(pollUpdate).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { deletedAt: expect.any(Date) as Date },
      });
    });
  });

  describe('findMeOnePoll', () => {
    it('throws NotFoundException when the poll does not exist or is not readable by the viewer', async () => {
      pollFindFirst.mockResolvedValue(null);
      voteFindUnique.mockResolvedValue(null);

      await expect(service.findMeOnePoll(7, viewer())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('reports hasVoted true when the requesting user has a vote on record', async () => {
      pollFindFirst.mockResolvedValue(makePoll());
      voteFindUnique.mockResolvedValue(makeVote());

      const result = await service.findMeOnePoll(7, viewer());

      expect(result.hasVoted).toBe(true);
    });

    it('reports hasVoted false when the lookup finds no vote', async () => {
      pollFindFirst.mockResolvedValue(makePoll());
      voteFindUnique.mockResolvedValue(null);

      const result = await service.findMeOnePoll(7, viewer());

      expect(result.hasVoted).toBe(false);
    });

    it("counts every vote on the poll, not just the requesting user's", async () => {
      pollFindFirst.mockResolvedValue(
        makePoll({
          votes: [makeVote({ id: 1 }), makeVote({ id: 2, createdById: 99 })],
        }),
      );
      voteFindUnique.mockResolvedValue(null);

      const result = await service.findMeOnePoll(7, viewer());

      expect(result.voterCount).toBe(2);
    });

    it('averages slider votes into a 0-1 sliderResult', async () => {
      pollFindFirst.mockResolvedValue(
        makePoll({
          type: 'slider',
          votes: [makeVote({ freeField: '80' }), makeVote({ freeField: '40' })],
        }),
      );
      voteFindUnique.mockResolvedValue(null);

      const result = await service.findMeOnePoll(7, viewer());

      // (80 + 40) / 2 votes / 100 = 0.6
      expect(result.sliderResult).toBeCloseTo(0.6);
    });

    it('leaves sliderResult at 0 for non-slider polls, even if freeField is set', async () => {
      pollFindFirst.mockResolvedValue(
        makePoll({
          type: 'multiple_choice',
          votes: [makeVote({ freeField: '80' })],
        }),
      );
      voteFindUnique.mockResolvedValue(null);

      const result = await service.findMeOnePoll(7, viewer());

      expect(result.sliderResult).toBe(0);
    });

    it('leaves sliderResult at 0 for a slider poll with no votes yet', async () => {
      pollFindFirst.mockResolvedValue(makePoll({ type: 'slider', votes: [] }));
      voteFindUnique.mockResolvedValue(null);

      const result = await service.findMeOnePoll(7, viewer());

      expect(result.sliderResult).toBe(0);
    });

    it('hides the author on an anonymous poll', async () => {
      pollFindFirst.mockResolvedValue(makePoll({ isAnonymous: true }));
      voteFindUnique.mockResolvedValue(null);

      const result = await service.findMeOnePoll(7, viewer());

      expect(result.createdBy).toBeNull();
    });

    it('keeps the author on a non-anonymous poll', async () => {
      const author = { id: 1, name: 'Author' };
      pollFindFirst.mockResolvedValue(
        makePoll({ isAnonymous: false, createdBy: author }),
      );
      voteFindUnique.mockResolvedValue(null);

      const result = await service.findMeOnePoll(7, viewer());

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

      const [pollOne, pollTwo] = (await service.findMeManyPolls(
        viewer(),
      )) as Array<{
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
        viewer(),
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

  describe('findUsersManyPolls', () => {
    it("matches hasVoted against the viewer's own votes", async () => {
      pollFindMany.mockResolvedValue([
        makePoll({ id: 1 }),
        makePoll({ id: 2 }),
      ]);
      voteFindMany.mockResolvedValue([makeVote({ pollId: 2 })]);

      const [pollOne, pollTwo] = (await service.findUsersManyPolls(
        viewer(),
        99,
      )) as Array<{ hasVoted: boolean }>;

      expect(pollOne.hasVoted).toBe(false);
      expect(pollTwo.hasVoted).toBe(true);
      expect(voteFindMany).toHaveBeenCalledWith({
        where: { createdById: 42, deletedAt: null },
      });
    });

    it("only queries the target's non-anonymous polls the viewer can read", async () => {
      pollFindMany.mockResolvedValue([]);
      voteFindMany.mockResolvedValue([]);

      await service.findUsersManyPolls(viewer(), 99);

      expect(pollFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: expect.arrayContaining([
              { createdById: 99, isAnonymous: false, deletedAt: null },
            ]) as unknown,
          },
        }),
      );
    });
  });

  describe('findMeVotedPolls', () => {
    it('returns the voted polls in most-recent-vote-first order', async () => {
      voteFindMany.mockResolvedValue([
        makeVote({ pollId: 3 }),
        makeVote({ pollId: 1 }),
        makeVote({ pollId: 2 }),
      ]);
      pollFindMany.mockResolvedValue([
        makePoll({ id: 1 }),
        makePoll({ id: 2 }),
        makePoll({ id: 3 }),
      ]);

      const polls = (await service.findMeVotedPolls(viewer())) as Array<{
        id: number;
        hasVoted: boolean;
      }>;

      expect(polls.map((poll) => poll.id)).toEqual([3, 1, 2]);
      expect(polls.every((poll) => poll.hasVoted)).toBe(true);
    });

    it('orders the vote lookup by createdAt desc and scopes to live votes', async () => {
      voteFindMany.mockResolvedValue([]);

      await service.findMeVotedPolls(viewer());

      expect(voteFindMany).toHaveBeenCalledWith({
        where: { createdById: 42, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('never hits the poll table when the viewer has no vote', async () => {
      voteFindMany.mockResolvedValue([]);

      await expect(service.findMeVotedPolls(viewer())).resolves.toEqual([]);
      expect(pollFindMany).not.toHaveBeenCalled();
    });

    it('drops a voted poll the read policy no longer returns', async () => {
      voteFindMany.mockResolvedValue([
        makeVote({ pollId: 1 }),
        makeVote({ pollId: 2 }),
      ]);
      pollFindMany.mockResolvedValue([makePoll({ id: 2 })]);

      const polls = (await service.findMeVotedPolls(viewer())) as Array<{
        id: number;
      }>;

      expect(polls.map((poll) => poll.id)).toEqual([2]);
    });

    it('scopes the poll read to the Poll policy, the voted ids and live rows', async () => {
      voteFindMany.mockResolvedValue([makeVote({ pollId: 5 })]);
      pollFindMany.mockResolvedValue([makePoll({ id: 5 })]);

      await service.findMeVotedPolls(viewer());

      expect(pollFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: expect.arrayContaining([
              { id: { in: [5] }, deletedAt: null },
            ]) as unknown,
          },
        }),
      );
    });
  });
});
