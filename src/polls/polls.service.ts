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

  /**
   * Creates a poll. Thin wrapper around {@link createPoll}.
   * @param userId - owner of the new poll
   * @param body - validated poll payload
   * @returns the created Poll (raw Prisma record)
   */
  async create(userId: number, body: PollCreateDTO) {
    return await this.createPoll(userId, body);
  }

  /**
   * Fetches one poll shaped for the requesting user: adds `hasVoted`,
   * `voterCount`, `sliderResult` (0 unless it's a slider poll), and nulls
   * out `createdBy` if the poll is anonymous.
   * @param id - poll id
   * @param userId - requesting user, used to compute `hasVoted`
   * @returns poll parsed against `PollReadSchema`
   * @throws if the poll doesn't exist or is deleted
   */
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

    return this.shapePollForUser(poll, hasVoted);
  }

  /**
   * Same as {@link findMeOnePoll} but for every poll the user created.
   *
   * Only two database queries run here, no matter how many polls the user
   * has: all of their polls, and all of their votes, fetched in parallel.
   * Each poll is then matched to its vote with `votesMadeByUser.find(...)`
   * in memory. The alternative — querying "did I vote on this?" separately
   * for each poll — is the classic N+1 query problem (1 query for the
   * polls + N more, one per poll), and gets slower as a user's poll count
   * grows.
   *
   * @param userId - owner whose polls (and votes) are fetched
   * @returns array of polls parsed against `PollReadSchema`
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
      const hasVoted = votesMadeByUser.some((v) => v.pollId === poll.id);
      return this.shapePollForUser(poll, hasVoted);
    });
  }

  // differences with me many polls.
  async findUsersManyPolls(userId: number, targetId: number) {
    this.logger.debug('entered the findUsersManyPolls');
    const [polls, votesMadeByUser] = await Promise.all([
      this.prisma.poll.findMany({
        where: {
          createdById: targetId,
          isAnonymous: false,
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
          createdById: targetId,
          deletedAt: null,
        },
      }),
    ]);

    return polls.map((poll) => {
      const hasVoted = votesMadeByUser.some((v) => v.pollId === poll.id);
      return this.shapePollForUser(poll, hasVoted);
    });
  }

  /**
   * Shapes a raw Prisma poll (relations already `include`d) into the DTO the
   * frontend expects: adds `voterCount` and `sliderResult`, nulls out
   * `createdBy` for anonymous polls, and validates the result against
   * `PollReadSchema`. `hasVoted` is passed in since computing it differs
   * between a single-poll lookup and a bulk one.
   *
   * Shared by {@link findMeOnePoll} and {@link findMeManyPolls} so this
   * logic — the slider math in particular — is written, and fixed, once.
   *
   * @param poll - poll with `type`, `isAnonymous`, `createdBy`, `votes` at least
   * @param hasVoted - whether the requesting user has voted on this poll
   * @returns the poll parsed against `PollReadSchema`
   */
  private shapePollForUser<
    T extends {
      type: string;
      isAnonymous: boolean;
      createdBy: unknown;
      votes: { freeField: string | null }[];
    },
  >(poll: T, hasVoted: boolean) {
    const voterCount = poll.votes.length;
    this.logger.debug(`voterCount is worth ${voterCount}`);

    let sliderResult = 0;
    if (poll.type === 'slider' && poll.votes.length > 0) {
      const sliderResultSum = poll.votes.reduce(
        (accumulator: number, vote) => accumulator + Number(vote.freeField),
        0,
      );
      sliderResult = sliderResultSum / poll.votes.length / 100;
    }

    const createdBy = poll.isAnonymous ? null : poll.createdBy;

    return PollReadSchema.parse({
      ...poll,
      hasVoted,
      voterCount,
      createdBy,
      sliderResult,
    });
  }

  /**
   * Case-insensitive title search over public, non-deleted polls.
   * @param q - search string
   * @returns up to `SEARCH_RESULTS_LIMIT` results, each `{ id, title }`
   */
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

  /**
   * Updates a poll after a CASL check that the user may `'update'` it.
   * @param id - poll id
   * @param userId - user attempting the update
   * @param body - validated fields to update
   * @returns the updated Poll
   * @throws `ForbiddenError` if the user lacks permission
   */
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

  /**
   * Soft-deletes a poll after a CASL check that the user may `'delete'` it.
   * @param id - poll id
   * @param userId - user attempting the deletion
   * @returns the updated (soft-deleted) Poll
   * @throws `ForbiddenError` if the user lacks permission
   */
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

  /** Placeholder, not implemented. Will report a poll for moderation. */
  report(id: number) {
    return `report Poll #${id} works`;
  }

  /** Placeholder, not implemented. Will report a single option. */
  reportOption(id: number, optionId: number) {
    return `report option #${optionId} for Poll #${id} works`;
  }

  /** Placeholder, not implemented. Will remove a single option from a poll. */
  removeOption(id: number, optionId: number) {
    return `remove option #${optionId} for Poll #${id} works`;
  }

  // Prisma Helpers — no authorization here, callers above already checked it.

  /**
   * Inserts a new poll. New polls always start `visibility: 'private'` and
   * `status: 'pending'`. Hashtags are connected-or-created before linking.
   * @param userId - owner of the poll
   * @param options - options to create with the poll
   * @param hashtags - hashtags to attach (created if they don't exist)
   * @param body - remaining poll fields
   * @returns the created Poll
   */
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
   * Updates a poll. `options`/`hashtags` are upserted, not replaced (so a
   * poll switched to type "slider" can get its label option on the fly).
   * `undefined` = field untouched, `[]` = clear it. `type` is immutable
   * after creation, hence `void type`. Only applies while `endsAt` is still
   * in the future.
   * @param id - poll id
   * @param options - new option set, or `undefined`/`[]`
   * @param hashtags - new hashtag set, or `undefined`/`[]`
   * @param body - remaining poll fields
   * @returns the updated Poll
   * @throws if the poll doesn't exist or has already ended
   */
  async updatePoll(
    id: number,
    { options, hashtags, type, ...body }: PollUpdateDTO,
  ): Promise<Poll> {
    void type;
    return this.prisma.poll.update({
      where: { id, endsAt: { gte: new Date() } },
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

  /**
   * Soft-deletes a poll by stamping `deletedAt` (row is never actually
   * removed; other queries filter it out via `deletedAt: null`).
   * @param id - poll id
   * @returns the updated Poll
   */
  async deletePoll(id: number) {
    return await this.prisma.poll.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}
