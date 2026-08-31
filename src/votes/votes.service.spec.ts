import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ForbiddenError } from '@casl/ability';
import {
  VoteCreateDTO,
  VoteUpdateDTO,
} from 'Pollpear_shared/src/schemas/vote.schema';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import type { User } from 'src/generated/prisma/client';
import { VotesService } from './votes.service';

/** A full-shaped `User` for the given id — what `@CurrentUser()` now hands
 * the service, in place of a bare id. */
function viewer(id = 42): User {
  return { id, role: 'user' } as User;
}

function poll(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    status: 'active',
    type: 'multiple_choice',
    endsAt: new Date(Date.now() + 60_000),
    allowChangeVote: true,
    // public, room-less poll: the simplest case that satisfies the CASL
    // create/vote conditions by default. Override per test to exercise
    // the other branches (private/room-scoped).
    visibility: 'public',
    roomId: null,
    createdBy: { blocksGiven: [], blocksReceived: [] },
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
    createdById: 42,
    deletedAt: null as Date | null,
    voteOptions: optionIds.map((optionId) => ({ optionId })),
  };
}

describe('VotesService', () => {
  const pollFindFirst = jest.fn();
  const pollUpdateMany = jest.fn();
  const optionFindMany = jest.fn();
  const roomUpdate = jest.fn();
  const voteFindUnique = jest.fn();
  const voteFindFirst = jest.fn();
  const voteUpsert = jest.fn();
  const voteUpdate = jest.fn();
  const prisma = {
    poll: { findFirst: pollFindFirst, updateMany: pollUpdateMany },
    room: { update: roomUpdate },
    option: { findMany: optionFindMany },
    vote: {
      findUnique: voteFindUnique,
      findFirst: voteFindFirst,
      upsert: voteUpsert,
      update: voteUpdate,
    },
  } as unknown as PrismaService;
  const service = new VotesService(prisma, new CaslAbilityFactory());

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
      pollFindFirst.mockResolvedValue(poll({ status: 'closed' }));

      const act = service.validateVote(7, 42, choiceBody(1));

      await expect(act).rejects.toThrow(ForbiddenException);
      await expect(act).rejects.toThrow('Poll is not active.');
    });

    it('rejects a poll past its end date and writes the closure through', async () => {
      pollFindFirst.mockResolvedValue(
        poll({ endsAt: new Date(Date.now() - 1_000) }),
      );

      const act = service.validateVote(7, 42, choiceBody(1));

      await expect(act).rejects.toThrow(ForbiddenException);
      await expect(act).rejects.toThrow('Poll is not active.');
      expect(pollUpdateMany).toHaveBeenCalledWith({
        where: { id: { in: [7] }, status: { not: 'closed' } },
        data: { status: 'closed' },
      });
    });

    it('rejects a body whose type differs from the poll type', async () => {
      pollFindFirst.mockResolvedValue(poll({ type: 'slider' }));

      const act = service.validateVote(7, 42, choiceBody(1));

      await expect(act).rejects.toThrow(BadRequestException);
      await expect(act).rejects.toThrow('Poll type does not match.');
    });

    it('rejects options that belong to another poll', async () => {
      pollFindFirst.mockResolvedValue(poll());
      optionFindMany.mockResolvedValue([{ id: 1 }]);

      await expect(
        service.validateVote(7, 42, choiceBody(1, 2)),
      ).rejects.toThrow(BadRequestException);
      expect(optionFindMany).toHaveBeenCalledWith({
        where: { pollId: 7, deletedAt: null, id: { in: [1, 2] } },
      });
    });

    it('passes a body without optionsVoted without checking options', async () => {
      pollFindFirst.mockResolvedValue(poll());
      const body: VoteUpdateDTO = { type: 'multiple_choice' };

      await expect(service.validateVote(7, 42, body)).resolves.toMatchObject({
        id: 7,
      });

      expect(pollFindFirst).toHaveBeenCalledWith({
        where: { id: 7, deletedAt: null },
        include: {
          room: {
            include: {
              roomMembers: { where: { userId: 42, deletedAt: null } },
            },
          },
          createdBy: {
            include: {
              blocksGiven: { where: { blockedId: 42 } },
              blocksReceived: { where: { blockerId: 42 } },
            },
          },
        },
      });
      expect(optionFindMany).not.toHaveBeenCalled();
    });
  });

  describe('findOneVote', () => {
    it("returns the caller's own vote", async () => {
      const row = { id: 99, createdById: 42, pollId: 7, deletedAt: null };
      voteFindUnique.mockResolvedValue(row);

      await expect(service.findOneVote(7, viewer())).resolves.toBe(row);

      expect(voteFindUnique).toHaveBeenCalledWith({
        where: {
          createdById_pollId: { createdById: 42, pollId: 7 },
          deletedAt: null,
        },
        include: { voteOptions: true },
      });
    });
  });

  describe('createVote', () => {
    beforeEach(() => {
      pollFindFirst.mockResolvedValue(poll());
      givenAllOptionsBelongToThePoll();
    });

    it('upserts on the caller and poll composite key and revives a soft-deleted vote', async () => {
      const row = { id: 99 };
      voteUpsert.mockResolvedValue(row);
      const body = choiceBody(1, 2);

      await expect(service.createVote(7, viewer(), body)).resolves.toBe(row);

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
      pollFindFirst.mockResolvedValue(poll({ type: 'slider' }));
      const body = sliderBody('both are fine');

      await service.createVote(7, viewer(), body);

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

    it('rejects voting on a private poll the caller cannot read', async () => {
      pollFindFirst.mockResolvedValue(
        poll({ visibility: 'private', createdById: 99 }),
      );

      await expect(
        service.createVote(7, viewer(), choiceBody(1)),
      ).rejects.toThrow(ForbiddenError);
      expect(voteUpsert).not.toHaveBeenCalled();
    });

    it('rejects voting on a poll attached to a closed room', async () => {
      pollFindFirst.mockResolvedValue(
        poll({
          visibility: 'public',
          roomId: 1,
          room: { status: 'closed', roomMembers: [] },
        }),
      );

      await expect(
        service.createVote(7, viewer(), choiceBody(1)),
      ).rejects.toThrow(ForbiddenError);
      expect(voteUpsert).not.toHaveBeenCalled();
    });
  });

  describe('updateVote', () => {
    beforeEach(() => {
      pollFindFirst.mockResolvedValue(poll());
      givenAllOptionsBelongToThePoll();
    });

    it('targets the caller active vote on the poll', async () => {
      voteFindFirst.mockResolvedValue(storedVote(1));

      await service.updateVote(7, viewer(), choiceBody(1));

      expect(voteFindFirst).toHaveBeenCalledWith({
        where: { pollId: 7, createdById: 42, deletedAt: null },
        include: { voteOptions: true },
      });
    });

    it('rejects the update when the poll disallows vote changes', async () => {
      pollFindFirst.mockResolvedValue(poll({ allowChangeVote: false }));

      await expect(
        service.updateVote(7, viewer(), choiceBody(1)),
      ).rejects.toThrow(ForbiddenException);
      expect(voteUpdate).not.toHaveBeenCalled();
    });

    it('rejects updating another user own vote', async () => {
      voteFindFirst.mockResolvedValue({
        ...storedVote(1),
        createdById: 99,
      });

      await expect(
        service.updateVote(7, viewer(), choiceBody(1)),
      ).rejects.toThrow(ForbiddenError);
      expect(voteUpdate).not.toHaveBeenCalled();
    });

    it('rejects updating a vote once the poll is closed', async () => {
      pollFindFirst.mockResolvedValue(poll({ status: 'closed' }));
      voteFindFirst.mockResolvedValue(storedVote(1));

      await expect(
        service.updateVote(7, viewer(), choiceBody(1)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates only the newly picked options', async () => {
      voteFindFirst.mockResolvedValue(storedVote(1));

      await service.updateVote(7, viewer(), choiceBody(1, 2));

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
      voteFindFirst.mockResolvedValue(storedVote(1, 2));

      await service.updateVote(7, viewer(), choiceBody(1));

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
      voteFindFirst.mockResolvedValue(storedVote(1, 2));

      await service.updateVote(7, viewer(), choiceBody(1, 2));

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
      voteFindFirst.mockResolvedValue(storedVote(1, 2));

      await service.updateVote(7, viewer(), { type: 'multiple_choice' });

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
      pollFindFirst.mockResolvedValue(poll({ type: 'slider' }));
      voteFindFirst.mockResolvedValue(storedVote(1));

      await service.updateVote(7, viewer(), sliderBody('still fine'));

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
    const votablePoll = (overrides: Record<string, unknown> = {}) => ({
      status: 'active',
      deletedAt: null,
      visibility: 'private',
      createdById: 42,
      roomId: null,
      ...overrides,
    });

    it('soft-deletes the caller active vote instead of removing the row', async () => {
      voteFindFirst.mockResolvedValue({
        id: 99,
        createdById: 42,
        deletedAt: null,
        poll: votablePoll(),
      });

      await service.deleteVote(7, viewer());

      expect(voteUpdate).toHaveBeenCalledWith({
        where: { id: 99 },
        data: { deletedAt: expect.any(Date) as Date },
      });
    });

    it('rejects deleting a vote once the poll is closed', async () => {
      voteFindFirst.mockResolvedValue({
        id: 99,
        createdById: 42,
        deletedAt: null,
        poll: votablePoll({ status: 'closed' }),
      });

      await expect(service.deleteVote(7, viewer())).rejects.toThrow(
        ForbiddenError,
      );
      expect(voteUpdate).not.toHaveBeenCalled();
    });

    it('rejects deleting a vote on a room poll once the caller has left the room', async () => {
      voteFindFirst.mockResolvedValue({
        id: 99,
        createdById: 42,
        deletedAt: null,
        poll: {
          status: 'active',
          deletedAt: null,
          visibility: 'private',
          createdById: 42,
          roomId: 5,
          room: { status: 'active', roomMembers: [] },
        },
      });

      await expect(service.deleteVote(7, viewer())).rejects.toThrow(
        ForbiddenError,
      );
      expect(voteUpdate).not.toHaveBeenCalled();
    });
  });
});
