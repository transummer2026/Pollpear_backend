import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ApiPollVoteService } from './vote.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { accessibleBy } from 'src/casl/casl-prisma';
import type { User } from 'src/generated/prisma/client';
import type { ApiVoteCastDTO } from '../../common/schemas/api-votes.schema';

const voter = { id: 7, role: 'user' } as unknown as User;

const openPoll = {
  id: 42,
  type: 'single_choice',
  status: 'active',
  endsAt: new Date('2099-01-01'),
  deletedAt: null,
  visibility: 'public',
  createdById: 9,
  roomId: null,
  allowChangeVote: true,
  createdBy: { blocksGiven: [], blocksReceived: [] },
  room: null,
};

const storedVote = {
  id: 5,
  pollId: 42,
  freeField: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  voteOptions: [{ optionId: 1 }],
};

const ballot: ApiVoteCastDTO = { type: 'single_choice', optionIds: [1] };

describe('ApiPollVoteService', () => {
  let service: ApiPollVoteService;
  const pollFindFirst = jest.fn<
    Promise<unknown>,
    [{ where: object; select: object }]
  >();
  const pollUpdate = jest.fn<Promise<unknown>, [{ data: object }]>();
  const voteFindFirst = jest.fn<Promise<unknown>, [{ where: object }]>();
  const voteUpsert = jest.fn<
    Promise<unknown>,
    [{ where: object; update: { deletedAt: Date | null } }]
  >();
  const voteUpdate = jest.fn<Promise<unknown>, [{ data: object }]>();
  const optionCount = jest.fn<Promise<number>, [{ where: object }]>();
  const pollUpdateMany = jest.fn<
    Promise<{ count: number }>,
    [{ where: object; data: object }]
  >();
  const roomUpdateMany = jest.fn<
    Promise<{ count: number }>,
    [{ where: object; data: object }]
  >();
  const transaction = jest.fn((run: (tx: unknown) => unknown) => run(client));

  /**
   * `$transaction` dans sa forme interactive : il rend au callback le meme
   * client, si bien qu'une ecriture faite dans la transaction se retrouve sur
   * les memes mocks que celles faites en dehors.
   */
  const client: Record<string, unknown> = {
    poll: {
      findFirst: pollFindFirst,
      update: pollUpdate,
      updateMany: pollUpdateMany,
    },
    vote: {
      findFirst: voteFindFirst,
      upsert: voteUpsert,
      update: voteUpdate,
    },
    option: { count: optionCount },
    room: { updateMany: roomUpdateMany },
    $transaction: (run: (tx: unknown) => unknown) => transaction(run),
  };

  beforeEach(async () => {
    [
      pollFindFirst,
      pollUpdate,
      voteFindFirst,
      voteUpsert,
      voteUpdate,
      optionCount,
      roomUpdateMany,
      transaction,
    ].forEach((fn) => fn.mockReset());
    transaction.mockImplementation((run) => run(client));
    roomUpdateMany.mockResolvedValue({ count: 0 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiPollVoteService,
        CaslAbilityFactory,
        {
          provide: PrismaService,
          useValue: client,
        },
      ],
    }).compile();

    service = module.get(ApiPollVoteService);
  });

  const pollIs = (poll: unknown) => pollFindFirst.mockResolvedValue(poll);
  const noVoteYet = () => voteFindFirst.mockResolvedValue(null);
  const everyOptionBelongs = () => optionCount.mockResolvedValue(1);

  describe('castVote', () => {
    it('scopes the poll lookup with the Poll policy', async () => {
      pollIs(openPoll);
      noVoteYet();
      everyOptionBelongs();
      voteUpsert.mockResolvedValue(storedVote);

      await service.castVote(42, ballot, voter);

      const where = pollFindFirst.mock.calls[0][0].where as { AND: unknown[] };
      expect(where.AND[0]).toEqual(
        accessibleBy(
          new CaslAbilityFactory().createForUser(voter),
          'read',
        ).ofType('Poll'),
      );
    });

    it('answers the stored vote with its option ids', async () => {
      pollIs(openPoll);
      noVoteYet();
      everyOptionBelongs();
      voteUpsert.mockResolvedValue(storedVote);

      await expect(service.castVote(42, ballot, voter)).resolves.toMatchObject({
        id: 5,
        pollId: 42,
        optionIds: [1],
      });
    });

    it('404s a poll the caller may not see', async () => {
      pollIs(null);

      await expect(service.castVote(42, ballot, voter)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('409s a poll whose deadline has passed', async () => {
      pollIs({ ...openPoll, endsAt: new Date('2020-01-01') });

      await expect(service.castVote(42, ballot, voter)).rejects.toThrow(
        ConflictException,
      );
      expect(voteUpsert).not.toHaveBeenCalled();
    });

    it('409s a closed poll', async () => {
      pollIs({ ...openPoll, status: 'closed' });

      await expect(service.castVote(42, ballot, voter)).rejects.toThrow(
        ConflictException,
      );
    });

    it('409s a poll whose room no longer takes votes', async () => {
      pollIs({
        ...openPoll,
        roomId: 3,
        room: { id: 3, status: 'closed', roomMembers: [] },
      });

      await expect(service.castVote(42, ballot, voter)).rejects.toThrow(
        ConflictException,
      );
      expect(voteUpsert).not.toHaveBeenCalled();
    });

    it('lets a member vote in an active room, reading only their membership', async () => {
      pollIs({
        ...openPoll,
        visibility: 'private',
        roomId: 3,
        room: {
          id: 3,
          status: 'active',
          roomMembers: [{ userId: 7, deletedAt: null }],
        },
      });
      noVoteYet();
      everyOptionBelongs();
      voteUpsert.mockResolvedValue(storedVote);

      await expect(service.castVote(42, ballot, voter)).resolves.toMatchObject({
        id: 5,
      });

      const select = pollFindFirst.mock.calls[0][0].select as {
        room: { select: { roomMembers: { where: object } } };
      };
      expect(select.room.select.roomMembers.where).toEqual({
        userId: 7,
        deletedAt: null,
      });
    });

    it('400s a ballot answering another poll type', async () => {
      pollIs({ ...openPoll, type: 'slider' });

      await expect(service.castVote(42, ballot, voter)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('400s an option that belongs to another poll', async () => {
      pollIs(openPoll);
      optionCount.mockResolvedValue(0);

      await expect(service.castVote(42, ballot, voter)).rejects.toThrow(
        BadRequestException,
      );
      expect(voteUpsert).not.toHaveBeenCalled();
    });

    it('409s a caller who already has a live vote', async () => {
      pollIs(openPoll);
      everyOptionBelongs();
      voteFindFirst.mockResolvedValue({ id: 5 });

      await expect(service.castVote(42, ballot, voter)).rejects.toThrow(
        ConflictException,
      );
      expect(voteUpsert).not.toHaveBeenCalled();
    });

    it('revives a withdrawn vote rather than adding a second one', async () => {
      pollIs(openPoll);
      noVoteYet();
      everyOptionBelongs();
      voteUpsert.mockResolvedValue(storedVote);

      await service.castVote(42, ballot, voter);

      const call = voteUpsert.mock.calls[0][0];
      expect(call.where).toEqual({
        createdById_pollId: { createdById: 7, pollId: 42 },
      });
      expect(call.update.deletedAt).toBeNull();
    });

    it('publishes a pending poll on its first vote', async () => {
      pollIs({ ...openPoll, status: 'pending' });
      noVoteYet();
      everyOptionBelongs();
      voteUpsert.mockResolvedValue(storedVote);

      await service.castVote(42, ballot, voter);

      expect(pollUpdate.mock.calls[0][0].data).toMatchObject({
        status: 'active',
      });
    });

    it('leaves an already active poll alone', async () => {
      pollIs(openPoll);
      noVoteYet();
      everyOptionBelongs();
      voteUpsert.mockResolvedValue(storedVote);

      await service.castVote(42, ballot, voter);

      expect(pollUpdate).not.toHaveBeenCalled();
    });
  });

  describe('changeVote', () => {
    it('409s a poll that forbids changing a vote', async () => {
      pollIs({ ...openPoll, allowChangeVote: false });

      await expect(service.changeVote(42, ballot, voter)).rejects.toThrow(
        ConflictException,
      );
      expect(voteUpdate).not.toHaveBeenCalled();
    });

    it('404s a caller who has not voted', async () => {
      pollIs(openPoll);
      noVoteYet();

      await expect(service.changeVote(42, ballot, voter)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('409s a poll that is not running yet', async () => {
      pollIs({ ...openPoll, status: 'pending' });

      await expect(service.changeVote(42, ballot, voter)).rejects.toThrow(
        ConflictException,
      );
      expect(voteUpdate).not.toHaveBeenCalled();
    });

    it('leaves the selection alone when the ballot carries none', async () => {
      pollIs({ ...openPoll, type: 'slider' });
      voteFindFirst.mockResolvedValue(storedVote);
      voteUpdate.mockResolvedValue(storedVote);

      await service.changeVote(42, { type: 'slider', freeField: 8 }, voter);

      const { data } = voteUpdate.mock.calls[0][0];
      expect(data).toEqual({ freeField: '8' });
      expect(optionCount).not.toHaveBeenCalled();
    });

    it('replaces the whole selection', async () => {
      pollIs(openPoll);
      voteFindFirst.mockResolvedValue(storedVote);
      everyOptionBelongs();
      voteUpdate.mockResolvedValue(storedVote);

      await service.changeVote(42, ballot, voter);

      expect(voteUpdate.mock.calls[0][0].data).toMatchObject({
        voteOptions: { deleteMany: {}, create: [{ optionId: 1 }] },
      });
    });
  });

  describe('withdrawVote', () => {
    it('soft deletes the vote', async () => {
      pollIs(openPoll);
      voteFindFirst.mockResolvedValue(storedVote);
      voteUpdate.mockResolvedValue(storedVote);

      await service.withdrawVote(42, voter);

      const { deletedAt } = voteUpdate.mock.calls[0][0].data as {
        deletedAt: Date;
      };
      expect(deletedAt).toBeInstanceOf(Date);
    });

    it('404s a caller who has not voted', async () => {
      pollIs(openPoll);
      noVoteYet();

      await expect(service.withdrawVote(42, voter)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('409s a poll that is not running yet', async () => {
      pollIs({ ...openPoll, status: 'pending' });

      await expect(service.withdrawVote(42, voter)).rejects.toThrow(
        ConflictException,
      );
      expect(voteUpdate).not.toHaveBeenCalled();
    });
  });

  describe('findMyVote', () => {
    it('still shows the vote once the poll is over', async () => {
      pollIs({ ...openPoll, status: 'closed', endsAt: new Date('2020-01-01') });
      voteFindFirst.mockResolvedValue(storedVote);

      await expect(service.findMyVote(42, voter)).resolves.toMatchObject({
        id: 5,
      });
    });

    it('scopes the lookup with the Vote policy, not a hand written clause', async () => {
      pollIs(openPoll);
      voteFindFirst.mockResolvedValue(storedVote);

      await service.findMyVote(42, voter);

      const where = voteFindFirst.mock.calls[0][0].where as { AND: unknown[] };
      expect(where.AND[0]).toEqual(
        accessibleBy(
          new CaslAbilityFactory().createForUser(voter),
          'read',
        ).ofType('Vote'),
      );
    });

    it('answers only the callers own vote', async () => {
      pollIs(openPoll);
      voteFindFirst.mockResolvedValue(storedVote);

      await expect(service.findMyVote(42, voter)).resolves.toMatchObject({
        id: 5,
      });
      const where = voteFindFirst.mock.calls[0][0].where as { AND: unknown[] };
      expect(where.AND[1]).toMatchObject({ createdById: 7, deletedAt: null });
    });
  });
  describe('une room qui ne prend plus de votes', () => {
    const membership = [{ userId: 7, deletedAt: null }];
    const inAClosedRoom = {
      ...openPoll,
      roomId: 3,
      room: { id: 3, status: 'closed', endsAt: null, roomMembers: membership },
    };

    it('409s a change of vote once the room is closed', async () => {
      pollIs(inAClosedRoom);

      await expect(service.changeVote(42, ballot, voter)).rejects.toThrow(
        ConflictException,
      );
      expect(voteUpdate).not.toHaveBeenCalled();
    });

    it('409s a withdrawal once the room is closed', async () => {
      pollIs(inAClosedRoom);

      await expect(service.withdrawVote(42, voter)).rejects.toThrow(
        ConflictException,
      );
      expect(voteUpdate).not.toHaveBeenCalled();
    });

    it('closes a lapsed room before deciding, then refuses the change', async () => {
      pollIs({
        ...inAClosedRoom,
        room: {
          id: 3,
          status: 'active',
          endsAt: new Date('2020-01-01'),
          roomMembers: membership,
        },
      });
      roomUpdateMany.mockResolvedValue({ count: 1 });

      await expect(service.changeVote(42, ballot, voter)).rejects.toThrow(
        ConflictException,
      );
      expect(roomUpdateMany.mock.calls[0][0]).toEqual({
        where: { id: { in: [3] }, status: 'active' },
        data: { status: 'closed' },
      });
      expect(voteUpdate).not.toHaveBeenCalled();
    });
  });

  describe('l ecriture du bulletin', () => {
    it('casts and publishes inside one transaction', async () => {
      pollIs({ ...openPoll, status: 'pending' });
      noVoteYet();
      everyOptionBelongs();
      voteUpsert.mockResolvedValue(storedVote);

      await service.castVote(42, ballot, voter);

      expect(transaction).toHaveBeenCalledTimes(1);
      const opened = transaction.mock.invocationCallOrder[0];
      expect(voteUpsert.mock.invocationCallOrder[0]).toBeGreaterThan(opened);
      expect(pollUpdate.mock.invocationCallOrder[0]).toBeGreaterThan(opened);
    });
  });
});
