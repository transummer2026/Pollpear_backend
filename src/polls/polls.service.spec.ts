import { ForbiddenError } from '@casl/ability';
import {
  PollCreateDTO,
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

describe('PollsService', () => {
  const pollCreate = jest.fn();
  const pollUpdate = jest.fn();
  const pollFindMany = jest.fn();
  const pollFindFirstOrThrow = jest.fn();
  const userFindUniqueOrThrow = jest.fn();
  const prisma = {
    poll: {
      create: pollCreate,
      update: pollUpdate,
      findMany: pollFindMany,
      findFirstOrThrow: pollFindFirstOrThrow,
    },
    user: { findUniqueOrThrow: userFindUniqueOrThrow },
  } as unknown as PrismaService;
  const buildOptionsNestedWrite = jest.fn();
  const buildHashtagsNestedWrite = jest.fn();
  const connectOrCreateHashtag = jest.fn();
  const service = new PollsService(
    prisma,
    new CaslAbilityFactory(),
    { buildOptionsNestedWrite } as unknown as OptionsService,
    {
      connectOrCreateHashtag,
      buildHashtagsNestedWrite,
    } as unknown as HashtagsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('forces private visibility, pending status and the caller as owner', async () => {
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
      connectOrCreateHashtag
        .mockResolvedValueOnce({ hashtagId: 1 })
        .mockResolvedValueOnce({ hashtagId: 2 });
      const body = createBody({
        hashtags: [{ name: 'dev' }, { name: 'life' }],
      });

      await service.create(42, body);

      expect(connectOrCreateHashtag).toHaveBeenNthCalledWith(1, 'dev');
      expect(connectOrCreateHashtag).toHaveBeenNthCalledWith(2, 'life');
      expect(pollCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          options: { create: body.options },
          pollHashtags: { create: [{ hashtagId: 1 }, { hashtagId: 2 }] },
        }) as object,
      });
    });

    it('skips hashtag resolution when the body carries none', async () => {
      await service.create(42, createBody());

      expect(connectOrCreateHashtag).not.toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('returns only live public polls capped at five', async () => {
      const found = [{ id: 7, title: 'Best pear variety?' }];
      pollFindMany.mockResolvedValue(found);

      await expect(service.search('pear')).resolves.toBe(found);

      expect(pollFindMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          visibility: 'public',
          title: { contains: 'pear', mode: 'insensitive' },
        },
        select: { id: true, title: true },
        take: 5,
      });
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
      expect(buildHashtagsNestedWrite).toHaveBeenCalledWith(7, body.hashtags);
      expect(pollUpdate).toHaveBeenCalledWith({
        where: { id: 7 },
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
});
