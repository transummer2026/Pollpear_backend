import { ForbiddenError, subject } from '@casl/ability';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { accessibleBy, AppAbility } from 'src/casl/casl-prisma';
import { OptionsService } from 'src/options/options.service';
import { HashtagsService } from 'src/hashtags/hashtags.service';
import {
  PollCreateDTO,
  PollReadSchema,
  PollUpdateDTO,
} from 'Pollpear_shared/src/schemas/polls.schema';
import { Poll, User } from 'src/generated/prisma/client';
import { Logger } from '@nestjs/common';

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
   * @param viewer - owner of the new poll
   * @param body - validated poll payload
   * @returns the created Poll (raw Prisma record)
   */
  async create(viewer: User, body: PollCreateDTO) {
    const ability = this.abilityFactory.createForUser(viewer);

    return await this.createPoll(viewer.id, body, ability);
  }

  /**
   * Updates a poll after a CASL check that the user may `'update'` it.
   * @param id - poll id
   * @param viewer - user attempting the update
   * @param body - validated fields to update
   * @returns the updated Poll
   * @throws `ForbiddenError` if the user lacks permission
   */
  async update(id: number, viewer: User, body: PollUpdateDTO) {
    const poll = await this.prisma.poll.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

    const ability = this.abilityFactory.createForUser(viewer);
    ForbiddenError.from(ability).throwUnlessCan(
      'update',
      subject('Poll', poll),
    );

    return await this.updatePoll(id, body, ability);
  }

  /**
   * Soft-deletes a poll after a CASL check that the user may `'delete'` it.
   * @param id - poll id
   * @param viewer - user attempting the deletion
   * @returns the updated (soft-deleted) Poll
   * @throws `ForbiddenError` if the user lacks permission
   */
  async remove(id: number, viewer: User) {
    const poll = await this.prisma.poll.findFirstOrThrow({
      where: { id, deletedAt: null },
    });

    const ability = this.abilityFactory.createForUser(viewer);
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

  /**
   * Inserts a new poll. New polls always start `visibility: 'private'` and
   * `status: 'pending'`. Hashtags are connected-or-created before linking.
   * @param userId - owner of the poll
   * @param options - options to create with the poll
   * @param hashtags - hashtags to attach (created if they don't exist)
   * @param body - remaining poll fields
   * @param ability - the caller's rules, consulted before each hashtag write
   * @returns the created Poll
   */
  async createPoll(
    userId: number,
    { options, hashtags, ...body }: PollCreateDTO,
    ability: AppAbility,
  ): Promise<Poll> {
    const pollHashtags = hashtags
      ? await Promise.all(
          hashtags.map((hashtag) =>
            this.hashtagsService.resolveHashtag(hashtag.name, ability),
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
   * @param ability - the caller's rules, consulted before each hashtag write
   * @returns the updated Poll
   * @throws if the poll doesn't exist or has already ended
   */
  async updatePoll(
    id: number,
    { options, hashtags, type, ...body }: PollUpdateDTO,
    ability: AppAbility,
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
          ability,
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

  /**
   * Fetches one poll shaped for the requesting user: adds `hasVoted`,
   * `voterCount`, `sliderResult` (0 unless it's a slider poll), and nulls
   * out `createdBy` if the poll is anonymous. The row is only loaded if the
   * CASL `read` policy allows it (own/public polls, or polls in a room the
   * viewer belongs to) — a poll outside that scope reports 404, same as any
   * other id that doesn't exist, rather than leaking that it exists.
   * @param id - poll id
   * @param viewer - requesting user, used for the read check and to
   * compute `hasVoted`
   * @returns poll parsed against `PollReadSchema`
   * @throws `NotFoundException` if the poll doesn't exist, is deleted, or
   * isn't readable by the viewer
   */
  async findMeOnePoll(id: number, viewer: User) {
    const ability = this.abilityFactory.createForUser(viewer);
    const [poll, userVote] = await Promise.all([
      this.prisma.poll.findFirst({
        where: {
          AND: [
            accessibleBy(ability, 'read').ofType('Poll'),
            { id, deletedAt: null },
          ],
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
          },
        },
      }),
      this.prisma.vote.findUnique({
        where: {
          createdById_pollId: {
            createdById: viewer.id,
            pollId: id,
          },
          deletedAt: null,
        },
      }),
    ]);
    if (!poll) throw new NotFoundException('Poll not found');
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
   * @param viewer - owner whose polls (and votes) are fetched
   * @returns array of polls parsed against `PollReadSchema`
   */
  async findMeManyPolls(viewer: User) {
    const ability = this.abilityFactory.createForUser(viewer);
    const [polls, votesMadeByUser] = await Promise.all([
      this.prisma.poll.findMany({
        where: {
          AND: [
            accessibleBy(ability, 'read').ofType('Poll'),
            {
              createdById: viewer.id,
              deletedAt: null,
            },
          ],
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
          createdById: viewer.id,
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
  async findUsersManyPolls(viewer: User, targetId: number) {
    this.logger.debug('entered the findUsersManyPolls');
    const ability = this.abilityFactory.createForUser(viewer);
    const [polls, votesMadeByUser] = await Promise.all([
      this.prisma.poll.findMany({
        where: {
          AND: [
            accessibleBy(ability, 'read').ofType('Poll'),
            { createdById: targetId, isAnonymous: false, deletedAt: null },
          ],
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
          createdById: viewer.id,
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
}
