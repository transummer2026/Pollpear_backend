import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { subject } from '@casl/ability';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { accessibleBy } from 'src/casl/casl-prisma';
import type { Prisma, User, Vote } from 'src/generated/prisma/client';
import { type AssertColumns } from '../../common/select';
import { PollStatus } from 'src/generated/prisma/enums';
import { syncRoomStatuses } from 'src/rooms/room-status';
import { syncPollStatuses } from 'src/polls/poll-status';
import { viewerOf, type Viewer } from '../../common/viewer';
import { ApiPollOfferedTypeSchema } from '../../common/schemas/api-polls.schema';
import {
  type ApiVoteCastDTO,
  type ApiVoteChangeDTO,
  type ApiVoteColumnsDTO,
  type ApiVoteDTO,
} from '../../common/schemas/api-votes.schema';
import { presentVote, VOTE_SELECT } from './vote.presentation';

export const pollForBallot = (viewerId: number) =>
  ({
    id: true,
    type: true,
    status: true,
    endsAt: true,
    deletedAt: true,
    visibility: true,
    createdById: true,
    roomId: true,
    allowChangeVote: true,
    createdBy: {
      select: {
        blocksGiven: {
          where: { blockedId: viewerId },
          select: { blockedId: true },
        },
        blocksReceived: {
          where: { blockerId: viewerId },
          select: { blockerId: true },
        },
      },
    },
    room: {
      select: {
        id: true,
        status: true,
        endsAt: true,
        roomMembers: {
          where: { userId: viewerId, deletedAt: null },
          select: { userId: true, deletedAt: true },
        },
      },
    },
  }) satisfies Prisma.PollSelect;

type PollForBallot = Prisma.PollGetPayload<{
  select: ReturnType<typeof pollForBallot>;
}>;

export const VOTE_MATCHES_MODEL: AssertColumns<ApiVoteColumnsDTO, Vote> = true;

@Injectable()
export class ApiPollVoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  async findMyVote(pollId: number, caller: User): Promise<ApiVoteDTO> {
    const ability = this.abilityFactory.createForUser(caller);
    const viewer = viewerOf(caller, ability);
    await this.findReadablePoll(pollId, viewer);

    return presentVote(await this.findMyLiveVote(pollId, viewer));
  }

  async castVote(
    pollId: number,
    ballot: ApiVoteCastDTO,
    caller: User,
  ): Promise<ApiVoteDTO> {
    const ability = this.abilityFactory.createForUser(caller);
    const viewer = viewerOf(caller, ability);
    const poll = await this.findVotablePoll(pollId, viewer);

    await this.assertBallotFits(poll, ballot);
    await this.assertNotAlreadyVoted(pollId, viewer);

    const vote = await this.prisma.$transaction(async (tx) => {
      const stored = await tx.vote.upsert({
        where: { createdById_pollId: { createdById: viewer.id, pollId } },
        create: {
          createdById: viewer.id,
          pollId,
          freeField: ballotValue(ballot),
          voteOptions: { create: chosenOptions(ballot) },
        },
        update: {
          deletedAt: null,
          freeField: ballotValue(ballot),
          voteOptions: { deleteMany: {}, create: chosenOptions(ballot) },
        },
        select: VOTE_SELECT,
      });

      await this.publishOnFirstVote(tx, poll);

      return stored;
    });

    return presentVote(vote);
  }

  async changeVote(
    pollId: number,
    ballot: ApiVoteChangeDTO,
    caller: User,
  ): Promise<ApiVoteDTO> {
    const ability = this.abilityFactory.createForUser(caller);
    const viewer = viewerOf(caller, ability);
    const poll = await this.findChangeablePoll(pollId, viewer);

    this.assertChangesAllowed(poll);

    const current = await this.findMyLiveVote(pollId, viewer);
    this.assertMayTouchOwnVote('update', current.id, poll, viewer);
    await this.assertBallotFits(poll, ballot);

    const vote = await this.prisma.vote.update({
      where: { id: current.id },
      data: changedFields(ballot),
      select: VOTE_SELECT,
    });

    return presentVote(vote);
  }

  async withdrawVote(pollId: number, caller: User): Promise<void> {
    const ability = this.abilityFactory.createForUser(caller);
    const viewer = viewerOf(caller, ability);
    const poll = await this.findChangeablePoll(pollId, viewer);
    const current = await this.findMyLiveVote(pollId, viewer);

    this.assertMayTouchOwnVote('delete', current.id, poll, viewer);

    await this.prisma.vote.update({
      where: { id: current.id },
      data: { deletedAt: new Date() },
    });
  }

  private async findVotablePoll(
    pollId: number,
    viewer: Viewer,
  ): Promise<PollForBallot> {
    const poll = await this.findReadablePoll(pollId, viewer);

    if (poll.status === PollStatus.closed) {
      throw new ConflictException('This poll no longer takes votes');
    }

    return poll;
  }

  private async findChangeablePoll(
    pollId: number,
    viewer: Viewer,
  ): Promise<PollForBallot> {
    const poll = await this.findReadablePoll(pollId, viewer);

    if (poll.status !== PollStatus.active) {
      throw new ConflictException('Only a running poll takes vote changes');
    }

    return poll;
  }

  private async findReadablePoll(
    pollId: number,
    viewer: Viewer,
  ): Promise<PollForBallot> {
    const poll = await this.prisma.poll.findFirst({
      where: {
        AND: [
          accessibleBy(viewer.ability, 'read').ofType('Poll'),
          { id: pollId, type: { in: ApiPollOfferedTypeSchema.options } },
        ],
      },
      select: pollForBallot(viewer.id),
    });

    if (!poll) {
      throw new NotFoundException('Poll not found');
    }

    if (poll.room) {
      [poll.room] = await syncRoomStatuses(this.prisma, [poll.room]);
    }

    const [synced] = await syncPollStatuses(this.prisma, [poll]);

    return synced;
  }

  private async findMyLiveVote(pollId: number, viewer: Viewer) {
    const vote = await this.prisma.vote.findFirst({
      where: {
        AND: [
          accessibleBy(viewer.ability, 'read').ofType('Vote'),
          { pollId, createdById: viewer.id, deletedAt: null },
        ],
      },
      select: VOTE_SELECT,
    });

    if (!vote) {
      throw new NotFoundException('Vote not found');
    }

    return vote;
  }

  private assertChangesAllowed(poll: PollForBallot): void {
    if (!poll.allowChangeVote) {
      throw new ConflictException('This poll does not allow changing a vote');
    }
  }

  private assertMayTouchOwnVote(
    action: 'update' | 'delete',
    voteId: number,
    poll: PollForBallot,
    viewer: Viewer,
  ): void {
    const owned = subject('Vote', {
      id: voteId,
      createdById: viewer.id,
      deletedAt: null,
      poll,
    } as unknown as Vote);

    if (viewer.ability.cannot(action, owned)) {
      throw new ForbiddenException('Not allowed to change this vote');
    }
  }

  private async assertNotAlreadyVoted(
    pollId: number,
    viewer: Viewer,
  ): Promise<void> {
    const live = await this.prisma.vote.findFirst({
      where: { pollId, createdById: viewer.id, deletedAt: null },
      select: { id: true },
    });

    if (live) {
      throw new ConflictException('You have already voted in this poll');
    }
  }

  private async assertBallotFits(
    poll: PollForBallot,
    ballot: ApiVoteCastDTO | ApiVoteChangeDTO,
  ): Promise<void> {
    if (poll.type !== ballot.type) {
      throw new BadRequestException(`This poll takes a ${poll.type} vote`);
    }

    if (!ballot.optionIds) {
      return;
    }

    const belonging = await this.prisma.option.count({
      where: { pollId: poll.id, deletedAt: null, id: { in: ballot.optionIds } },
    });

    if (belonging !== new Set(ballot.optionIds).size) {
      throw new BadRequestException('An option does not belong to this poll');
    }
  }

  private async publishOnFirstVote(
    tx: Prisma.TransactionClient,
    poll: PollForBallot,
  ): Promise<void> {
    if (poll.status !== PollStatus.pending) {
      return;
    }

    await tx.poll.update({
      where: { id: poll.id },
      data: { status: PollStatus.active, publishedAt: new Date() },
    });
  }
}

function ballotValue(ballot: ApiVoteCastDTO): string | null {
  return ballot.type === 'slider' ? String(ballot.freeField) : null;
}

function chosenOptions(ballot: ApiVoteCastDTO): { optionId: number }[] {
  return ballot.optionIds.map((optionId) => ({ optionId }));
}

function changedFields(ballot: ApiVoteChangeDTO) {
  const value =
    ballot.type === 'slider' && ballot.freeField !== undefined
      ? { freeField: String(ballot.freeField) }
      : {};
  const options = ballot.optionIds
    ? {
        voteOptions: {
          deleteMany: {},
          create: ballot.optionIds.map((optionId) => ({ optionId })),
        },
      }
    : {};

  return { ...value, ...options };
}
