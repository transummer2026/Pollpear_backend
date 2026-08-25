import { ConflictException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { UserRole } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { HashtagsService } from './hashtags.service';

function abilityFor(role: UserRole) {
  return new CaslAbilityFactory().createForUser({ id: 1, role });
}

function link(pollId: number, hashtagId: number, name: string) {
  return { pollId, hashtagId, hashtag: { id: hashtagId, name } };
}

function uniqueConstraintFailed() {
  return new Prisma.PrismaClientKnownRequestError('raw database detail', {
    code: 'P2002',
    clientVersion: '7.8.0',
  });
}

function deletedHashtag() {
  return { id: 12, name: 'dev', deletedAt: new Date('2026-01-01') };
}

describe('HashtagsService', () => {
  const hashtagFindUnique = jest.fn();
  const hashtagCreate = jest.fn();
  const hashtagFindUniqueOrThrow = jest.fn();
  const hashtagUpdate = jest.fn();
  const pollHashtagFindMany = jest.fn();
  const prisma = {
    hashtag: {
      findUnique: hashtagFindUnique,
      findUniqueOrThrow: hashtagFindUniqueOrThrow,
      create: hashtagCreate,
      update: hashtagUpdate,
    },
    pollHashtag: { findMany: pollHashtagFindMany },
  } as unknown as PrismaService;
  const service = new HashtagsService(prisma);
  const user = abilityFor(UserRole.user);
  const moderator = abilityFor(UserRole.moderator);
  const admin = abilityFor(UserRole.admin);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveHashtag', () => {
    it('creates the hashtag when the name is free', async () => {
      hashtagFindUnique.mockResolvedValue(null);
      hashtagCreate.mockResolvedValue({ id: 12, name: 'dev' });

      await expect(service.resolveHashtag('dev', user)).resolves.toEqual({
        hashtagId: 12,
      });

      expect(hashtagCreate).toHaveBeenCalledWith({ data: { name: 'dev' } });
    });

    it('reuses a live hashtag without writing to it', async () => {
      hashtagFindUnique.mockResolvedValue({
        id: 12,
        name: 'dev',
        deletedAt: null,
      });

      await expect(service.resolveHashtag('dev', user)).resolves.toEqual({
        hashtagId: 12,
      });

      expect(hashtagCreate).not.toHaveBeenCalled();
      expect(hashtagUpdate).not.toHaveBeenCalled();
    });

    it('reuses the hashtag a concurrent request created first', async () => {
      hashtagFindUnique.mockResolvedValue(null);
      hashtagCreate.mockRejectedValue(uniqueConstraintFailed());
      hashtagFindUniqueOrThrow.mockResolvedValue({
        id: 77,
        name: 'dev',
        deletedAt: null,
      });

      await expect(service.resolveHashtag('dev', user)).resolves.toEqual({
        hashtagId: 77,
      });
    });

    it('lets any other database error through', async () => {
      const boom = new Error('connection lost');
      hashtagFindUnique.mockResolvedValue(null);
      hashtagCreate.mockRejectedValue(boom);

      await expect(service.resolveHashtag('dev', user)).rejects.toThrow(boom);

      expect(hashtagFindUniqueOrThrow).not.toHaveBeenCalled();
    });

    it.each([
      ['a user', () => user],
      ['a moderator', () => moderator],
      ['an admin', () => admin],
    ])(
      'refuses a deleted hashtag to %s, and never revives it',
      async (_who, abilityOf) => {
        hashtagFindUnique.mockResolvedValue(deletedHashtag());

        await expect(
          service.resolveHashtag('dev', abilityOf()),
        ).rejects.toThrow(ConflictException);

        expect(hashtagUpdate).not.toHaveBeenCalled();
        expect(hashtagCreate).not.toHaveBeenCalled();
      },
    );
  });

  describe('buildHashtagsNestedWrite', () => {
    it('returns undefined and leaves the links alone when the field is absent', async () => {
      await expect(
        service.buildHashtagsNestedWrite(5, undefined, user),
      ).resolves.toBeUndefined();

      expect(pollHashtagFindMany).not.toHaveBeenCalled();
      expect(hashtagFindUnique).not.toHaveBeenCalled();
    });

    it('disconnects every hashtag when the field is sent empty', async () => {
      pollHashtagFindMany.mockResolvedValue([
        link(5, 1, 'dev'),
        link(5, 2, 'life'),
      ]);

      const write = await service.buildHashtagsNestedWrite(5, [], user);

      expect(write).toEqual({
        create: [],
        deleteMany: [
          { pollId: 5, hashtagId: 1 },
          { pollId: 5, hashtagId: 2 },
        ],
      });
      expect(hashtagFindUnique).not.toHaveBeenCalled();
    });

    it('creates only the names not linked yet and drops the removed ones', async () => {
      pollHashtagFindMany.mockResolvedValue([
        link(5, 1, 'dev'),
        link(5, 2, 'life'),
      ]);
      hashtagFindUnique.mockResolvedValue(null);
      hashtagCreate.mockResolvedValue({ id: 33, name: 'food' });

      const write = await service.buildHashtagsNestedWrite(
        5,
        [{ name: 'life' }, { name: 'food' }],
        user,
      );

      expect(hashtagFindUnique).toHaveBeenCalledTimes(1);
      expect(hashtagFindUnique).toHaveBeenCalledWith({
        where: { name: 'food' },
      });
      expect(write).toEqual({
        create: [{ hashtagId: 33 }],
        deleteMany: [{ pollId: 5, hashtagId: 1 }],
      });
    });

    it('changes nothing when the incoming names match the current ones', async () => {
      pollHashtagFindMany.mockResolvedValue([link(5, 1, 'dev')]);

      const write = await service.buildHashtagsNestedWrite(
        5,
        [{ name: 'dev' }],
        user,
      );

      expect(write).toEqual({ create: [], deleteMany: [] });
      expect(hashtagFindUnique).not.toHaveBeenCalled();
    });

    it('refuses the whole write when one name is a deleted hashtag', async () => {
      pollHashtagFindMany.mockResolvedValue([]);
      hashtagFindUnique.mockResolvedValue(deletedHashtag());

      await expect(
        service.buildHashtagsNestedWrite(5, [{ name: 'dev' }], user),
      ).rejects.toThrow(ConflictException);
    });
  });
});
