import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  VoteCreateDTO,
  VoteUpdateDTO,
} from 'Pollpear_shared/src/schemas/vote.schema';
import { PrismaService } from 'src/prisma/prisma.service';
import { VotesService } from './votes.service';

function poll(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    status: 'active',
    type: 'multiple_choice',
    endsAt: new Date(Date.now() + 60_000),
    allowChangeVote: true,
    ...overrides,
  };
}

function choiceBody(...optionIds: number[]): VoteCreateDTO {
  return {
    type: 'multiple_choice',
    optionsVoted: optionIds.map((optionId) => ({ optionId })),
  };
}

function sliderBody(freeField: string): VoteCreateDTO {
  return { type: 'slider', optionsVoted: [{ optionId: 1 }], freeField };
}

function storedVote(...optionIds: number[]) {
  return {
    id: 99,
    voteOptions: optionIds.map((optionId) => ({ optionId })),
  };
}

describe('VotesService', () => {
  const pollFindFirstOrThrow = jest.fn();
  const optionFindMany = jest.fn();
  const voteFindUnique = jest.fn();
  const voteFindFirstOrThrow = jest.fn();
  const voteUpsert = jest.fn();
  const voteUpdate = jest.fn();
  const prisma = {
    poll: { findFirstOrThrow: pollFindFirstOrThrow },
    option: { findMany: optionFindMany },
    vote: {
      findUnique: voteFindUnique,
      findFirstOrThrow: voteFindFirstOrThrow,
      upsert: voteUpsert,
      update: voteUpdate,
    },
  } as unknown as PrismaService;
  const service = new VotesService(prisma);

  function givenAllOptionsBelongToThePoll() {
    optionFindMany.mockImplementation(
      (query: { where: { id: { in: number[] } } }) =>
        Promise.resolve(query.where.id.in.map((id) => ({ id }))),
    );
  }

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-17T12:00:00Z'));
    jest.clearAllMocks();
    voteFindUnique.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('validateVote', () => {
    it('rejects a poll that is not active', async () => {
      pollFindFirstOrThrow.mockResolvedValue(poll({ status: 'closed' }));

      const act = service.validateVote(7, choiceBody(1));

      await expect(act).rejects.toThrow(ForbiddenException);
      await expect(act).rejects.toThrow('Poll is not active.');
    });

    it('rejects a poll past its end date', async () => {
      pollFindFirstOrThrow.mockResolvedValue(
        poll({ endsAt: new Date(Date.now() - 1_000) }),
      );

      const act = service.validateVote(7, choiceBody(1));

      await expect(act).rejects.toThrow(ForbiddenException);
      await expect(act).rejects.toThrow('Poll is closed.');
    });

    it('rejects a body whose type differs from the poll type', async () => {
      pollFindFirstOrThrow.mockResolvedValue(poll({ type: 'slider' }));

      const act = service.validateVote(7, choiceBody(1));

      await expect(act).rejects.toThrow(BadRequestException);
      await expect(act).rejects.toThrow('Poll type does not match.');
    });

    it('rejects options that belong to another poll', async () => {
      pollFindFirstOrThrow.mockResolvedValue(poll());
      optionFindMany.mockResolvedValue([{ id: 1 }]);

      await expect(service.validateVote(7, choiceBody(1, 2))).rejects.toThrow(
        BadRequestException,
      );
      expect(optionFindMany).toHaveBeenCalledWith({
        where: { pollId: 7, deletedAt: null, id: { in: [1, 2] } },
      });
    });

    it('passes a body without optionsVoted without checking options', async () => {
      pollFindFirstOrThrow.mockResolvedValue(poll());
      const body: VoteUpdateDTO = { type: 'multiple_choice' };

      await expect(service.validateVote(7, body)).resolves.toMatchObject({
        id: 7,
      });

      expect(pollFindFirstOrThrow).toHaveBeenCalledWith({
        where: { id: 7, deletedAt: null },
      });
      expect(optionFindMany).not.toHaveBeenCalled();
    });
  });

  describe('createVote', () => {
    beforeEach(() => {
      pollFindFirstOrThrow.mockResolvedValue(poll());
      givenAllOptionsBelongToThePoll();
    });

    it('upserts on the caller and poll composite key and revives a soft-deleted vote', async () => {
      const row = { id: 99 };
      voteUpsert.mockResolvedValue(row);
      const body = choiceBody(1, 2);

      await expect(service.createVote(7, 42, body)).resolves.toBe(row);

      expect(voteUpsert).toHaveBeenCalledWith({
        where: { createdById_pollId: { createdById: 42, pollId: 7 } },
        create: {
          createdById: 42,
          pollId: 7,
          voteOptions: { create: body.optionsVoted },
        },
        update: {
          deletedAt: null,
          freeField: null,
          voteOptions: { deleteMany: {}, create: body.optionsVoted },
        },
      });
    });

    it('stores the free field only for slider votes', async () => {
      pollFindFirstOrThrow.mockResolvedValue(poll({ type: 'slider' }));
      const body = sliderBody('both are fine');

      await service.createVote(7, 42, body);

      expect(voteUpsert).toHaveBeenCalledWith({
        where: { createdById_pollId: { createdById: 42, pollId: 7 } },
        create: {
          createdById: 42,
          pollId: 7,
          freeField: 'both are fine',
          voteOptions: { create: body.optionsVoted },
        },
        update: {
          deletedAt: null,
          freeField: 'both are fine',
          voteOptions: { deleteMany: {}, create: body.optionsVoted },
        },
      });
    });
  });

  describe('updateVote', () => {
    beforeEach(() => {
      pollFindFirstOrThrow.mockResolvedValue(poll());
      givenAllOptionsBelongToThePoll();
    });

    it('targets the caller active vote on the poll', async () => {
      voteFindFirstOrThrow.mockResolvedValue(storedVote(1));

      await service.updateVote(7, 42, choiceBody(1));

      expect(voteFindFirstOrThrow).toHaveBeenCalledWith({
        where: { pollId: 7, createdById: 42, deletedAt: null },
        include: { voteOptions: true },
      });
    });

    it('rejects the update when the poll disallows vote changes', async () => {
      pollFindFirstOrThrow.mockResolvedValue(poll({ allowChangeVote: false }));

      await expect(service.updateVote(7, 42, choiceBody(1))).rejects.toThrow(
        ForbiddenException,
      );
      expect(voteUpdate).not.toHaveBeenCalled();
    });

    it('creates only the newly picked options', async () => {
      voteFindFirstOrThrow.mockResolvedValue(storedVote(1));

      await service.updateVote(7, 42, choiceBody(1, 2));

      expect(voteUpdate).toHaveBeenCalledWith({
        where: { id: 99 },
        data: {
          voteOptions: {
            deleteMany: { optionId: { in: [] } },
            create: [{ optionId: 2 }],
          },
        },
      });
    });

    it('deletes only the dropped options', async () => {
      voteFindFirstOrThrow.mockResolvedValue(storedVote(1, 2));

      await service.updateVote(7, 42, choiceBody(1));

      expect(voteUpdate).toHaveBeenCalledWith({
        where: { id: 99 },
        data: {
          voteOptions: {
            deleteMany: { optionId: { in: [2] } },
            create: [],
          },
        },
      });
    });

    it('changes nothing when the selection is identical', async () => {
      voteFindFirstOrThrow.mockResolvedValue(storedVote(1, 2));

      await service.updateVote(7, 42, choiceBody(1, 2));

      expect(voteUpdate).toHaveBeenCalledWith({
        where: { id: 99 },
        data: {
          voteOptions: {
            deleteMany: { optionId: { in: [] } },
            create: [],
          },
        },
      });
    });

    it('drops every current option when optionsVoted is absent', async () => {
      voteFindFirstOrThrow.mockResolvedValue(storedVote(1, 2));

      await service.updateVote(7, 42, { type: 'multiple_choice' });

      expect(optionFindMany).not.toHaveBeenCalled();
      expect(voteUpdate).toHaveBeenCalledWith({
        where: { id: 99 },
        data: {
          voteOptions: {
            deleteMany: { optionId: { in: [1, 2] } },
            create: [],
          },
        },
      });
    });

    it('passes the slider free field through', async () => {
      pollFindFirstOrThrow.mockResolvedValue(poll({ type: 'slider' }));
      voteFindFirstOrThrow.mockResolvedValue(storedVote(1));

      await service.updateVote(7, 42, sliderBody('still fine'));

      expect(voteUpdate).toHaveBeenCalledWith({
        where: { id: 99 },
        data: {
          freeField: 'still fine',
          voteOptions: {
            deleteMany: { optionId: { in: [] } },
            create: [],
          },
        },
      });
    });
  });

  describe('deleteVote', () => {
    it('soft-deletes the caller active vote instead of removing the row', async () => {
      voteFindFirstOrThrow.mockResolvedValue({ id: 99 });

      await service.deleteVote(7, 42);

      expect(voteFindFirstOrThrow).toHaveBeenCalledWith({
        where: { pollId: 7, createdById: 42, deletedAt: null },
      });
      expect(voteUpdate).toHaveBeenCalledWith({
        where: { id: 99 },
        data: { deletedAt: expect.any(Date) as Date },
      });
    });
  });
});
