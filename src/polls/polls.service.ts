import { ForbiddenError, subject } from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { OptionsService } from 'src/options/options.service';
import { HashtagsService } from 'src/hashtags/hashtags.service';
import {
  PollCreateDTO,
  PollReadSchema,
  PollUpdateDTO,
} from 'Pollpear_shared/src/schemas/polls.schema';
import { Poll } from 'src/generated/prisma/client';
import { Logger } from '@nestjs/common';

const SEARCH_RESULTS_LIMIT = 5;

@Injectable()
export class PollsService {
  constructor(
    private prisma: PrismaService,
    private abilityFactory: CaslAbilityFactory,
    private optionsService: OptionsService,
    private hashtagsService: HashtagsService,
    private logger: Logger,
  ) {}

  async create(userId: number, body: PollCreateDTO) {
    return await this.createPoll(userId, body);
  }

  async findMeOnePoll(id: number, userId: number) {
    const [poll, userVote] = await Promise.all([
      this.prisma.poll.findUniqueOrThrow({
        where: { id, deletedAt: null },
        include: {
          options: {
            where: { deletedAt: null },
            include: {
              _count: {
                select: {
                  voteOptions: true,
                },
              },
            },
          },
          createdBy: true,
          room: { where: { deletedAt: null } },
          pollHashtags: {
            include: {
              hashtag: true,
            },
          },
          votes: {
            where: { deletedAt: null },
          },
        },
      }),
      this.prisma.vote.findUnique({
        where: {
          createdById_pollId: {
            createdById: userId,
            pollId: id,
          },
          deletedAt: null,
        },
      }),
    ]);
    const hasVoted = userVote !== null;

    const voterCount = poll.votes.length;
    this.logger.debug(`voterCount is worth ${voterCount}`);

    let sliderResult = 0;
    if (poll.type === 'slider' && poll.votes.length > 0) {
      const sliderResultSum = poll.votes.reduce(
        (accumulator: number, vote: { freeField: string | null }) => {
          return accumulator + Number(vote.freeField);
        },
        0,
      );
      sliderResult = sliderResultSum / poll.votes.length / 100;
    }
    return PollReadSchema.parse({
      ...poll,
      hasVoted,
      voterCount,
      sliderResult,
    });
  }

  /**
   * @param userId
   * @returns
   * after the findmany, I get an array of polls (all of them)
   * and I get an array of all the votes the user has made
   */
  async findMeManyPolls(userId: number) {
    const [polls, votesMadeByUser] = await Promise.all([
      this.prisma.poll.findMany({
        where: {
          createdById: userId,
          deletedAt: null,
        },
        include: {
          options: {
            where: { deletedAt: null },
            include: {
              _count: {
                select: {
                  voteOptions: true,
                },
              },
            },
          },
          createdBy: true,
          room: { where: { deletedAt: null } },
          pollHashtags: {
            include: {
              hashtag: true,
            },
          },
          votes: {
            where: { deletedAt: null },
            include: {
              _count: {
                select: {
                  voteOptions: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.vote.findMany({
        where: {
          createdById: userId,
          deletedAt: null,
        },
      }),
    ]);
    return polls.map((poll) => {
      const voteMadeByUser = votesMadeByUser.find((v) => v.pollId === poll.id);
      const hasVoted = voteMadeByUser != null && voteMadeByUser != undefined;

      const voterCount = poll.votes.length;
      this.logger.debug(`voterCount is worth ${voterCount}`);

      let sliderResult = 0;
      if (poll.type === 'slider' && poll.votes.length > 0) {
        const sliderResultSum = poll.votes.reduce(
          (accumulator: number, vote: { freeField: string | null }) => {
            return accumulator + Number(vote.freeField);
          },
          0,
        );
        sliderResult = sliderResultSum / poll.votes.length / 100;
        this.logger.debug(`slider result is worth ${sliderResult}`);
      }
      return PollReadSchema.parse({
        ...poll,
        hasVoted,
        voterCount,
        sliderResult,
      });
    });
  }

  search(q: string) {
    return this.prisma.poll.findMany({
      where: {
        deletedAt: null,
        visibility: 'public',
        title: { contains: q, mode: 'insensitive' },
      },
      select: { id: true, title: true },
      take: SEARCH_RESULTS_LIMIT,
    });
  }

  async update(id: number, userId: number, body: PollUpdateDTO) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const poll = await this.prisma.poll.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

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
    const poll = await this.prisma.poll.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

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

  // Prisma Helpers

  async createPoll(
    userId: number,
    { options, hashtags, ...body }: PollCreateDTO,
  ): Promise<Poll> {
    const pollHashtags = hashtags
      ? await Promise.all(
          hashtags.map((hashtag) =>
            this.hashtagsService.connectOrCreateHashtag(hashtag.name),
          ),
        )
      : undefined;

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
          create: pollHashtags,
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
    { options, hashtags, type, ...body }: PollUpdateDTO,
  ): Promise<Poll> {
    void type;
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
    return await this.prisma.poll.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}
