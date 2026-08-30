import { ServiceUnavailableException } from '@nestjs/common';
import { FeedService } from './feed.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PollsService } from 'src/polls/polls.service';
import { AiService } from 'src/ai/ai.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { accessibleBy } from 'src/casl/casl-prisma';
import type { User } from 'src/generated/prisma/client';
import type { FeedEntry } from 'src/ai/ai.schema';

const VIEWER_ID = 1;

function makeViewer(overrides: Partial<User> = {}): User {
  return {
    id: VIEWER_ID,
    username: 'pollpear',
    email: 'viewer@pollpear.com',
    role: 'user',
    visibility: 'public',
    passwordHash: 'hash',
    deletedAt: null,
    ...overrides,
  } as User;
}

function abilityFor(viewer: User) {
  return new CaslAbilityFactory().createForUser(viewer);
}

function entry(pollId: number, score: number): FeedEntry {
  return { poll_id: pollId, title: `poll ${pollId}`, score };
}

type PollQuery = { where: object; include: object };

describe('FeedService', () => {
  let service: FeedService;
  const pollFindMany = jest.fn<Promise<{ id: number }[]>, [PollQuery]>();
  const voteFindMany = jest.fn<Promise<unknown[]>, [object]>();
  const getFeed = jest.fn<Promise<FeedEntry[]>, [number, number]>();
  const shapeManyPollsForUser = jest.fn((polls: { id: number }[]) =>
    polls.map((poll) => ({ id: poll.id })),
  );
  const viewer = makeViewer();

  beforeEach(() => {
    pollFindMany.mockReset();
    voteFindMany.mockReset().mockResolvedValue([]);
    getFeed.mockReset();
    shapeManyPollsForUser.mockClear();

    service = new FeedService(
      {
        poll: { findMany: pollFindMany },
        vote: { findMany: voteFindMany },
      } as unknown as PrismaService,
      new CaslAbilityFactory(),
      { shapeManyPollsForUser } as unknown as PollsService,
      { getFeed } as unknown as AiService,
    );
  });

  it('asks the recommender for the viewer id and the given limit', async () => {
    getFeed.mockResolvedValue([entry(2, 0.9)]);
    pollFindMany.mockResolvedValue([{ id: 2 }]);

    await service.getFeed(viewer, 25);

    expect(getFeed).toHaveBeenCalledWith(VIEWER_ID, 25);
  });

  it('returns the hydrated polls in the recommender order', async () => {
    getFeed.mockResolvedValue([entry(4, 0.9), entry(2, 0.7), entry(9, 0.5)]);
    pollFindMany.mockResolvedValue([{ id: 2 }, { id: 9 }, { id: 4 }]);

    const feed = await service.getFeed(viewer, 25);

    expect(feed.map((poll) => poll.id)).toEqual([4, 2, 9]);
  });

  it('drops a ranked poll the read policy hides', async () => {
    getFeed.mockResolvedValue([entry(4, 0.9), entry(2, 0.7)]);
    pollFindMany.mockResolvedValue([{ id: 4 }]);

    const feed = await service.getFeed(viewer, 25);

    expect(feed.map((poll) => poll.id)).toEqual([4]);
  });

  it('scopes the database read to the Poll read policy, the ranked ids and live rows', async () => {
    getFeed.mockResolvedValue([entry(4, 0.9), entry(2, 0.7)]);
    pollFindMany.mockResolvedValue([{ id: 4 }, { id: 2 }]);

    await service.getFeed(viewer, 25);

    expect(pollFindMany.mock.calls[0][0].where).toEqual({
      AND: [
        accessibleBy(abilityFor(viewer), 'read').ofType('Poll'),
        { id: { in: [4, 2] }, deletedAt: null },
      ],
    });
  });

  it('never touches the database when the recommender returns nothing', async () => {
    getFeed.mockResolvedValue([]);

    await expect(service.getFeed(viewer, 25)).resolves.toEqual([]);
    expect(pollFindMany).not.toHaveBeenCalled();
  });

  it('propagates the 503 when the recommender is down', async () => {
    getFeed.mockRejectedValue(new ServiceUnavailableException());

    await expect(service.getFeed(viewer, 25)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(pollFindMany).not.toHaveBeenCalled();
  });
});
