import { PrismaService } from 'src/prisma/prisma.service';
import { HashtagsService } from './hashtags.service';

function link(pollId: number, hashtagId: number, name: string) {
  return { pollId, hashtagId, hashtag: { id: hashtagId, name } };
}

describe('HashtagsService', () => {
  const hashtagUpsert = jest.fn();
  const pollHashtagFindMany = jest.fn();
  const prisma = {
    hashtag: { upsert: hashtagUpsert },
    pollHashtag: { findMany: pollHashtagFindMany },
  } as unknown as PrismaService;
  const service = new HashtagsService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('connectOrCreateHashtag', () => {
    it('upserts by name, revives a soft-deleted hashtag and returns its id', async () => {
      hashtagUpsert.mockResolvedValue({ id: 12, name: 'dev' });

      await expect(service.connectOrCreateHashtag('dev')).resolves.toEqual({
        hashtagId: 12,
      });

      expect(hashtagUpsert).toHaveBeenCalledWith({
        where: { name: 'dev' },
        create: { name: 'dev' },
        update: { deletedAt: null },
      });
    });
  });

  describe('buildHashtagsNestedWrite', () => {
    it('returns undefined and leaves the links alone when the field is absent', async () => {
      await expect(
        service.buildHashtagsNestedWrite(5, undefined),
      ).resolves.toBeUndefined();

      expect(pollHashtagFindMany).not.toHaveBeenCalled();
      expect(hashtagUpsert).not.toHaveBeenCalled();
    });

    it('disconnects every hashtag when the field is sent empty', async () => {
      pollHashtagFindMany.mockResolvedValue([
        link(5, 1, 'dev'),
        link(5, 2, 'life'),
      ]);

      const write = await service.buildHashtagsNestedWrite(5, []);

      expect(write).toEqual({
        create: [],
        deleteMany: [
          { pollId: 5, hashtagId: 1 },
          { pollId: 5, hashtagId: 2 },
        ],
      });
      expect(hashtagUpsert).not.toHaveBeenCalled();
    });

    it('creates only the names not linked yet and drops the removed ones', async () => {
      pollHashtagFindMany.mockResolvedValue([
        link(5, 1, 'dev'),
        link(5, 2, 'life'),
      ]);
      hashtagUpsert.mockResolvedValue({ id: 33, name: 'food' });

      const write = await service.buildHashtagsNestedWrite(5, [
        { name: 'life' },
        { name: 'food' },
      ]);

      expect(hashtagUpsert).toHaveBeenCalledTimes(1);
      expect(hashtagUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { name: 'food' } }),
      );
      expect(write).toEqual({
        create: [{ hashtagId: 33 }],
        deleteMany: [{ pollId: 5, hashtagId: 1 }],
      });
    });

    it('changes nothing when the incoming names match the current ones', async () => {
      pollHashtagFindMany.mockResolvedValue([link(5, 1, 'dev')]);

      const write = await service.buildHashtagsNestedWrite(5, [
        { name: 'dev' },
      ]);

      expect(write).toEqual({ create: [], deleteMany: [] });
      expect(hashtagUpsert).not.toHaveBeenCalled();
    });
  });
});
