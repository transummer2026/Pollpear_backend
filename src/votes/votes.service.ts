import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  VoteCreateDTO,
  VoteUpdateDTO,
} from 'Pollpear_shared/src/schemas/vote.schema';
import { Vote } from 'src/generated/prisma/client';

@Injectable()
export class VotesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Vote is soft-deleted, but (createdById, pollId) stays unique, so a
   * re-vote after removal has to revive the existing row rather than
   * create a new one - same upsert-revival pattern as hashtags.
   */
  async createVote(
    pollId: number,
    userId: number,
    body: VoteCreateDTO,
  ): Promise<Vote> {
    await this.validateVote(pollId, body);
    return this.prisma.vote.upsert({
      where: { createdById_pollId: { createdById: userId, pollId } },
      create: {
        createdById: userId,
        pollId,
        freeField: body.type === 'slider' ? body.freeField : undefined,
        voteOptions: {
          create: body.optionsVoted,
        },
      },
      update: {
        deletedAt: null,
        freeField: body.type === 'slider' ? body.freeField : null,
        voteOptions: {
          deleteMany: {},
          create: body.optionsVoted,
        },
      },
    });
  }

  /**
   * Same coordinates as createVote (createdById + pollId), but here the
   * vote must already exist and be active: the ones in new and not in
   * current are to create, the ones in current and not in new are to delete.
   */
  async updateVote(pollId: number, userId: number, body: VoteUpdateDTO) {
    await this.validateVote(pollId, body);
    const vote = await this.prisma.vote.findFirstOrThrow({
      where: { pollId, createdById: userId, deletedAt: null },
      include: { voteOptions: true },
    });
    const incomingOptionsVoted = (body.optionsVoted ?? []).map(
      (o) => o.optionId,
    );
    const currentOptionsVoted = vote.voteOptions.map((vo) => vo.optionId);
    const optionsToCreate = incomingOptionsVoted.filter(
      (id) => !currentOptionsVoted.includes(id),
    );
    const optionsToDelete = currentOptionsVoted.filter(
      (id) => !incomingOptionsVoted.includes(id),
    );
    return this.prisma.vote.update({
      where: { id: vote.id },
      data: {
        freeField: body.type === 'slider' ? body.freeField : undefined,
        voteOptions: {
          deleteMany: {
            optionId: { in: optionsToDelete },
          },
          create: optionsToCreate.map((optionId) => ({ optionId })),
        },
      },
    });
  }

  async deleteVote(pollId: number, userId: number) {
    const vote = await this.prisma.vote.findFirstOrThrow({
      where: { pollId, createdById: userId, deletedAt: null },
    });
    return this.prisma.vote.update({
      where: { id: vote.id },
      data: { deletedAt: new Date() },
    });
  }

  reportVote(id: number) {
    return `report vote in Poll #${id} works`;
  }

  async validateVote(pollId: number, body: VoteCreateDTO | VoteUpdateDTO) {
    const poll = await this.prisma.poll.findFirstOrThrow({
      where: { id: pollId, deletedAt: null },
    });
    if (poll.status !== 'active')
      throw new ForbiddenException('Poll is not active.');
    if (poll.endsAt < new Date())
      throw new ForbiddenException('Poll is closed.');
    if (poll.type !== body.type)
      throw new BadRequestException('Poll type does not match.');
    if (!body.optionsVoted) return;
    const optionIds = body.optionsVoted.map(
      (optionVoted) => optionVoted.optionId,
    );
    const optionsWithSamePollId = await this.prisma.option.findMany({
      where: {
        pollId: pollId,
        deletedAt: null,
        id: {
          in: optionIds,
        },
      },
    });
    if (optionIds.length != optionsWithSamePollId.length) {
      throw new BadRequestException();
    }
  }
}
