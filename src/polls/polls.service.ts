import { ForbiddenError, subject } from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { OptionsService } from 'src/options/options.service';
import { HashtagsService } from 'src/hashtags/hashtags.service';
import {
  PollCreationDTO,
  PollUpdateDTO,
} from 'Pollpear_shared/src/schemas/polls.schema';
import { Poll } from 'src/generated/prisma/client';

@Injectable()
export class PollsService {
  constructor(
    private prisma: PrismaService,
    private abilityFactory: CaslAbilityFactory,
    private optionsService: OptionsService,
    private hashtagsService: HashtagsService,
  ) {}

  async create(userId: number, body: PollCreationDTO) {
    return await this.createPoll(userId, body);
  }

  async update(id: number, userId: number, body: PollUpdateDTO) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const poll = await this.prisma.poll.findUniqueOrThrow({ where: { id } });

    const ability = this.abilityFactory.createForUser(user);
    ForbiddenError.from(ability).throwUnlessCan(
      'update',
      subject('Poll', poll),
    );

    return await this.updatePoll(id, body);
  }

  async remove(id: number, userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const poll = await this.prisma.poll.findUniqueOrThrow({ where: { id } });

    const ability = this.abilityFactory.createForUser(user);
    ForbiddenError.from(ability).throwUnlessCan(
      'delete',
      subject('Poll', poll),
    );
    return this.deletePoll(id);
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

  // Prisma Helpers

  async createPoll(
    userId: number,
    { options, hashtags, ...body }: PollCreationDTO,
  ): Promise<Poll> {
    return this.prisma.poll.create({
      data: {
        ...body,
        visibility: 'private',
        status: 'pending',
        createdById: userId,
        options: {
          create: options,
        },
        pollHashtags: {
          create: hashtags?.map((hashtag) =>
            this.hashtagsService.connectOrCreateHashtag(hashtag.name),
          ),
        },
      },
    });
  }

  /**
   * Upsert is used for options in case the user chose multiple choice first
   * and then switched to a slider, whose label would otherwise not exist yet.
   *
   * options/hashtags undefined => field absent from the request => leave as is.
   * options/hashtags === [] => field explicitly sent empty => clear them.
   */
  async updatePoll(
    id: number,
    { options, hashtags, ...body }: PollUpdateDTO,
  ): Promise<Poll> {
    return this.prisma.poll.update({
      where: { id },
      data: {
        ...body,
        options: await this.optionsService.buildOptionsNestedWrite(id, options),
        pollHashtags: await this.hashtagsService.buildHashtagsNestedWrite(
          id,
          hashtags,
        ),
      },
    });
  }

  async deletePoll(id: number) {
    return await this.prisma.poll.delete({
      where: { id },
    });
  }
}
