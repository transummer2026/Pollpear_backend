import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { FeedQuerySchema } from './feed.query';
import type { User } from 'src/generated/prisma/client';

const viewer = { id: 1 } as User;

describe('FeedController', () => {
  let controller: FeedController;
  const getFeed = jest.fn();

  beforeEach(() => {
    getFeed.mockReset().mockResolvedValue([]);
    controller = new FeedController({ getFeed } as unknown as FeedService);
  });

  it('hands the viewer and the requested limit to the service', async () => {
    await controller.getFeed(viewer, { limit: 25 });

    expect(getFeed).toHaveBeenCalledWith(viewer, 25);
  });
});

describe('FeedQuerySchema', () => {
  it('defaults the limit when the client sends none', () => {
    expect(FeedQuerySchema.parse({})).toEqual({ limit: 25 });
  });

  it('coerces the limit from the query string', () => {
    expect(FeedQuerySchema.parse({ limit: '9' })).toEqual({ limit: 9 });
  });

  it('refuses a limit past the cap', () => {
    expect(FeedQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
  });

  it('refuses a non-positive limit', () => {
    expect(FeedQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
  });
});
