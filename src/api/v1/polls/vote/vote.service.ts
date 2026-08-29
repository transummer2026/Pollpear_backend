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
import { viewerOf, type Viewer } from '../../common/viewer';
import { ApiPollOfferedTypeSchema } from '../../common/schemas/api-polls.schema';
import {
  type ApiVoteCastDTO,
  type ApiVoteColumnsDTO,
  type ApiVoteDTO,
} from '../../common/schemas/api-votes.schema';
import { presentVote, VOTE_SELECT } from './vote.presentation';

const pollForBallot = (viewerId: number) =>
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
    room: {
      select: {
        id: true,
        status: true,
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
    const viewer = this.viewer(caller);
    await this.readablePoll(pollId, viewer);

    return presentVote(await this.myLiveVote(pollId, viewer));
  }

  async castVote(
    pollId: number,
    ballot: ApiVoteCastDTO,
    caller: User,
  ): Promise<ApiVoteDTO> {
    const viewer = this.viewer(caller);
    const poll = await this.votablePoll(pollId, viewer);

    this.assertMayVote(poll, viewer);
    await this.assertBallotFits(poll, ballot);
    await this.assertNotAlreadyVoted(pollId, viewer);

    const vote = await this.prisma.vote.upsert({
      where: { createdById_pollId: { createdById: viewer.id, pollId } },
      create: {
        createdById: viewer.id,
        pollId,
        freeField: freeFieldOf(ballot),
        voteOptions: { create: optionRowsOf(ballot) },
      },
      update: {
        deletedAt: null,
        freeField: freeFieldOf(ballot),
        voteOptions: { deleteMany: {}, create: optionRowsOf(ballot) },
      },
      select: VOTE_SELECT,
    });

    await this.publishOnFirstVote(poll);

    return presentVote(vote);
  }

  async changeVote(
    pollId: number,
    ballot: ApiVoteCastDTO,
    caller: User,
  ): Promise<ApiVoteDTO> {
    const viewer = this.viewer(caller);
    const poll = await this.changeablePoll(pollId, viewer);

    if (!poll.allowChangeVote) {
      throw new ConflictException('This poll does not allow changing a vote');
    }

    const current = await this.myLiveVote(pollId, viewer);
    this.assertMayTouchOwnVote('update', current.id, poll, viewer);
    await this.assertBallotFits(poll, ballot);

    const vote = await this.prisma.vote.update({
      where: { id: current.id },
      data: {
        freeField: freeFieldOf(ballot),
        voteOptions: { deleteMany: {}, create: optionRowsOf(ballot) },
      },
      select: VOTE_SELECT,
    });

    return presentVote(vote);
  }

  async withdrawVote(pollId: number, caller: User): Promise<void> {
    const viewer = this.viewer(caller);
    const poll = await this.changeablePoll(pollId, viewer);
    const current = await this.myLiveVote(pollId, viewer);

    this.assertMayTouchOwnVote('delete', current.id, poll, viewer);

    await this.prisma.vote.update({
      where: { id: current.id },
      data: { deletedAt: new Date() },
    });
  }

  private viewer(caller: User): Viewer {
    return viewerOf(caller, this.abilityFactory.createForUser(caller));
  }

  private async votablePoll(
    pollId: number,
    viewer: Viewer,
  ): Promise<PollForBallot> {
    const poll = await this.readablePoll(pollId, viewer);

    if (poll.status === PollStatus.closed || poll.endsAt <= new Date()) {
      throw new ConflictException('This poll no longer takes votes');
    }

    return poll;
  }

  private async changeablePoll(
    pollId: number,
    viewer: Viewer,
  ): Promise<PollForBallot> {
    const poll = await this.readablePoll(pollId, viewer);

    if (poll.status !== PollStatus.active || poll.endsAt <= new Date()) {
      throw new ConflictException('Only a running poll takes vote changes');
    }

    return poll;
  }

  private async readablePoll(
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

    return poll;
  }

  private async myLiveVote(pollId: number, viewer: Viewer) {
    const vote = await this.prisma.vote.findFirst({
      where: { pollId, createdById: viewer.id, deletedAt: null },
      select: VOTE_SELECT,
    });

    if (!vote) {
      throw new NotFoundException('Vote not found');
    }

    return vote;
  }

  private assertMayVote(poll: PollForBallot, viewer: Viewer): void {
    const ballot = subject('Vote', { poll } as unknown as Vote);

    if (viewer.ability.cannot('create', ballot)) {
      throw new ForbiddenException('Not allowed to vote in this poll');
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
    ballot: ApiVoteCastDTO,
  ): Promise<void> {
    if (poll.type !== ballot.type) {
      throw new BadRequestException(`This poll takes a ${poll.type} vote`);
    }

    const belonging = await this.prisma.option.count({
      where: { pollId: poll.id, deletedAt: null, id: { in: ballot.optionIds } },
    });

    if (belonging !== new Set(ballot.optionIds).size) {
      throw new BadRequestException('An option does not belong to this poll');
    }
  }

  private async publishOnFirstVote(poll: PollForBallot): Promise<void> {
    if (poll.status !== PollStatus.pending) {
      return;
    }

    await this.prisma.poll.update({
      where: { id: poll.id },
      data: { status: PollStatus.active, publishedAt: new Date() },
    });
  }
}

function freeFieldOf(ballot: ApiVoteCastDTO): string | null {
  return ballot.type === 'slider' ? ballot.freeField : null;
}

function optionRowsOf(ballot: ApiVoteCastDTO): { optionId: number }[] {
  return ballot.optionIds.map((optionId) => ({ optionId }));
}
