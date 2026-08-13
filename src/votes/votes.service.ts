import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  VoteCreationDTO,
  VoteUpdateDTO,
} from 'Pollpear_shared/src/schemas/vote.schema';
import { Vote } from 'src/generated/prisma/client';

@Injectable()
export class VotesService {
  constructor(private prisma: PrismaService) {}

  async createVote(
    pollId: number,
    userId: number,
    body: VoteCreationDTO,
  ): Promise<Vote> {
    await this.validateVote(pollId, body);
    return this.prisma.vote.create({
      data: {
        createdById: userId,
        pollId,
        label: body.type === 'slider' ? body.label : undefined,
        voteOptions: {
          create: body.optionsVoted,
        },
      },
    });
  }

  /**
   * receicve pollid and userid, I have a unique key in my schema.prismna
   * @@unique([pollid, createdById]) so that a user can only vote once
   * in a poll. This is a constraint, but also a way for me to find xactly
   * where it is like coordinates. SO here I receive pollId and userId
   * meaning I can target the exact vote in my db.
   * I receive a list of votes to update. the ones in new and not in current
   * are to create. the ones in current and not in new are to delete.
   */
  async updateVote(pollId: number, userId: number, body: VoteUpdateDTO) {
    await this.validateVote(pollId, body);
    const incomingOptionsVoted = body.optionsVoted.map((o) => o.optionId);
    const vote = await this.prisma.vote.findUniqueOrThrow({
      where: { pollId_createdById: { pollId, createdById: userId } },
      include: { voteOptions: true },
    });
    const currentOptionsVoted = vote.voteOptions.map((vo) => vo.optionId);
    const optionsToCreate = incomingOptionsVoted.filter(
      (id) => !currentOptionsVoted.includes(id),
    );
    const optionsToDelete = currentOptionsVoted.filter(
      (vo) => !incomingOptionsVoted.includes(vo),
    );
    return this.prisma.vote.update({
      where: { id: vote.id },
      data: {
        label: body.type === 'slider' ? body.label : undefined,
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
    return await this.prisma.vote.delete({
      where: { pollId_createdById: { pollId, createdById: userId } },
    });
  }

  reportVote(id: number) {
    return `report vote in Poll #${id} works`;
  }

  async validateVote(pollId: number, body: VoteCreationDTO) {
    const poll = await this.prisma.poll.findUniqueOrThrow({
      where: { id: pollId },
    });
    if (poll.status !== 'active')
      throw new ForbiddenException('Poll is not active.');
    if (poll.endsAt < new Date())
      throw new ForbiddenException('Poll is closed.');
    if (poll.type !== body.type)
      throw new BadRequestException('Poll type does not match.');
    const optionIds = body.optionsVoted.map(
      (optionVoted) => optionVoted.optionId,
    );
    const optionsWithSamePollId = await this.prisma.option.findMany({
      where: {
        pollId: pollId,
        isDeleted: false,
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
// the id of the vote is sent in a vote
