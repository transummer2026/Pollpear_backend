import { Injectable } from '@nestjs/common';
import { PollStatus } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';

export type CastVoteResult =
  | { outcome: 'ok'; pollId: number }
  | { outcome: 'not_found' | 'closed' | 'locked' };

@Injectable()
export class PollsService {
  constructor(private readonly prisma: PrismaService) {}

  create() {
    return 'add new poll route works';
  }

  update(id: number) {
    return `update poll #${id} works`;
  }

  remove(id: number) {
    return `remove poll #${id} works`;
  }

  report(id: number) {
    return `report Poll #${id} works`;
  }

  reportOption(id: number, optionId: number) {
    return `report option #${optionId} for Poll #${id} works`;
  }

  removeOption(id: number, optionId: number) {
    return `remove option #${optionId} for Poll #${id} works`;
  }

  createVote(id: number) {
    return `create vote in Poll #${id} works`;
  }

  updateVote(id: number) {
    return `update vote in Poll ${id}`;
  }

  removeVote(id: number) {
    return `remove vote in Poll #${id} works`;
  }

  reportVote(id: number) {
    return `report vote in Poll #${id} works`;
  }
  /**
   *
   * @param userId
   * @param optionId
   * @returns
   */
  async castVote(userId: number, optionId: number): Promise<CastVoteResult> {
    const option = await this.prisma.option.findFirst({
      where: { id: optionId, isDeleted: false },
      select: {
        pollId: true,
        poll: { select: { status: true, endsAt: true, allowChangeVote: true } },
      },
    });
    if (!option) return { outcome: 'not_found' };
    if (
      option.poll.status !== PollStatus.active ||
      option.poll.endsAt <= new Date()
    ) {
      return { outcome: 'closed' };
    }

    const existing = await this.prisma.vote.findFirst({
      where: {
        createdById: userId,
        voteOptions: { some: { option: { pollId: option.pollId } } },
      },
      select: { id: true },
    });

    if (!existing) {
      await this.prisma.vote.create({
        data: { createdById: userId, voteOptions: { create: { optionId } } },
      });
      return { outcome: 'ok', pollId: option.pollId };
    }

    if (!option.poll.allowChangeVote) return { outcome: 'locked' };
    await this.prisma.voteOption.deleteMany({ where: { voteId: existing.id } });
    await this.prisma.voteOption.create({
      data: { voteId: existing.id, optionId },
    });
    return { outcome: 'ok', pollId: option.pollId };
  }
}
