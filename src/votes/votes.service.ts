import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ForbiddenError, subject } from '@casl/ability';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import {
  VoteCreateDTO,
  VoteUpdateDTO,
} from 'Pollpear_shared/src/schemas/vote.schema';
import { User, Vote } from 'src/generated/prisma/client';

@Injectable()
export class VotesService {
  constructor(
    private prisma: PrismaService,
    private abilityFactory: CaslAbilityFactory,
  ) {}

  async findOneVote(pollid: number, viewer: User) {
    const vote = await this.prisma.vote.findUnique({
      where: {
        createdById_pollId: {
          createdById: viewer.id,
          pollId: pollid,
        },
        deletedAt: null,
      },
      include: {
        voteOptions: true,
      },
    });
    if (!vote) throw new NotFoundException('Vote not found');

    const ability = this.abilityFactory.createForUser(viewer);
    ForbiddenError.from(ability).throwUnlessCan('read', subject('Vote', vote));

    return vote;
  }

  /**
   * Vote is soft-deleted, but (createdById, pollId) stays unique, so a
   * re-vote after removal has to revive the existing row rather than
   * create a new one - same upsert-revival pattern as hashtags.
   * The upsert only revives a soft-deleted row;
   * an active vote must go through updateVote instead
   */
  async createVote(
    pollId: number,
    viewer: User,
    body: VoteCreateDTO,
  ): Promise<Vote> {
    const poll = await this.validateVote(pollId, viewer.id, body);

    const ability = this.abilityFactory.createForUser(viewer);
    ForbiddenError.from(ability).throwUnlessCan(
      'create',
      subject('Vote', { poll } as unknown as Vote),
    );

    const userId = viewer.id;
    const existingVote = await this.prisma.vote.findUnique({
      where: {
        createdById_pollId: {
          createdById: userId,
          pollId,
        },
      },
    });
    if (existingVote && !existingVote.deletedAt) {
      throw new ConflictException('User has already voted in this poll');
    }
    const vote = this.prisma.vote.upsert({
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
    if (poll.status === 'pending') {
      await this.prisma.poll.update({
        where: {
          id: pollId,
        },
        data: {
          status: 'active',
          publishedAt: new Date(),
        },
      });
    }
    return vote;
  }

  /**
   * Same coordinates as createVote (createdById + pollId), but here the
   * vote must already exist and be active: the ones in new and not in
   * current are to create, the ones in current and not in new are to delete.
   */
  async updateVote(pollId: number, viewer: User, body: VoteUpdateDTO) {
    const poll = await this.validateVote(pollId, viewer.id, body);
    if (!poll.allowChangeVote) {
      throw new ForbiddenException('This poll does not allow vote changes.');
    }
    const vote = await this.prisma.vote.findFirst({
      where: { pollId, createdById: viewer.id, deletedAt: null },
      include: { voteOptions: true },
    });
    if (!vote) throw new NotFoundException('Vote not found');

    const ability = this.abilityFactory.createForUser(viewer);
    ForbiddenError.from(ability).throwUnlessCan(
      'update',
      subject('Vote', { ...vote, poll }),
    );

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

  async deleteVote(pollId: number, viewer: User) {
    const vote = await this.prisma.vote.findFirst({
      where: { pollId, createdById: viewer.id, deletedAt: null },
      include: { poll: true },
    });
    if (!vote) throw new NotFoundException('Vote not found');

    const ability = this.abilityFactory.createForUser(viewer);
    ForbiddenError.from(ability).throwUnlessCan(
      'delete',
      subject('Vote', vote),
    );

    return this.prisma.vote.update({
      where: { id: vote.id },
      data: { deletedAt: new Date() },
    });
  }

  reportVote(id: number) {
    return `report vote in Poll #${id} works`;
  }

  async validateVote(
    pollId: number,
    viewerId: number,
    body: VoteCreateDTO | VoteUpdateDTO,
  ) {
    const poll = await this.prisma.poll.findFirst({
      where: { id: pollId, deletedAt: null },
      include: {
        room: {
          include: {
            roomMembers: { where: { userId: viewerId, deletedAt: null } },
          },
        },
      },
    });
    if (!poll) throw new NotFoundException('Poll not found');
    if (poll.status === 'closed')
      throw new ForbiddenException('Poll is not active.');
    if (poll.endsAt < new Date())
      throw new ForbiddenException('Poll is closed.');
    if (poll.type !== body.type)
      throw new BadRequestException('Poll type does not match.');
    if (!body.optionsVoted) return poll;
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
    return poll;
  }
}
