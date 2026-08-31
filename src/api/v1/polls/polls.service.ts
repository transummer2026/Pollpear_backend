// src/api/v1/polls/polls.service.ts
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { subject } from '@casl/ability';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { accessibleBy, type AppAbility } from 'src/casl/casl-prisma';
import type { Option, Poll, Prisma, User } from 'src/generated/prisma/client';
import { PollStatus, PollType } from 'src/generated/prisma/enums';
import { viewerOf, type Viewer } from '../common/viewer';
import { selectOf, type AssertColumns } from '../common/select';
import {
  assertLimitAllowed,
  assertPageWithin,
  pageMeta,
} from '../common/pagination';
import { skipFor } from '../common/schemas/api-pagination.schema';
import { matching, authorOf, authorOnFeed } from './polls.presentation';
import {
  ApiPollOfferedTypeSchema,
  ApiPollAuthorSchema,
  ApiPollColumnsSchema,
  ApiPollListColumnsSchema,
  ApiPollOptionSchema,
  ApiPollPageSchema,
  ApiPollResultsSchema,
  MAX_DISTRIBUTION,
  ApiPollSchema,
  type ApiPollAuthorDTO,
  type ApiPollColumnsDTO,
  type ApiPollCreateDTO,
  type ApiPollDTO,
  type ApiPollListColumnsDTO,
  type ApiPollOptionDTO,
  type ApiPollPageDTO,
  type ApiPollQueryDTO,
  type ApiPollResultsDTO,
  type ApiPollUpdateDTO,
} from '../common/schemas/api-polls.schema';

const AUTHOR_SELECT = { select: selectOf(ApiPollAuthorSchema) };

const OPTIONS_SELECT = {
  where: { deletedAt: null },
  orderBy: { order: 'asc' },
  select: selectOf(ApiPollOptionSchema),
} satisfies Prisma.Poll$optionsArgs;

const LIVE_VOTES = { select: { votes: { where: { deletedAt: null } } } };

const LIST_SELECT = {
  ...selectOf(ApiPollListColumnsSchema),
  isAnonymous: true,
  createdBy: AUTHOR_SELECT,
  _count: LIVE_VOTES,
} satisfies Prisma.PollSelect;

const DETAIL_SELECT = {
  ...selectOf(ApiPollColumnsSchema),
  createdById: true,
  deletedAt: true,
  createdBy: AUTHOR_SELECT,
  options: OPTIONS_SELECT,
  _count: LIVE_VOTES,
} satisfies Prisma.PollSelect;

export const LIST_MATCHES_MODEL: AssertColumns<ApiPollListColumnsDTO, Poll> =
  true;
export const DETAIL_MATCHES_MODEL: AssertColumns<ApiPollColumnsDTO, Poll> =
  true;
export const OPTION_MATCHES_MODEL: AssertColumns<ApiPollOptionDTO, Option> =
  true;
export const AUTHOR_MATCHES_MODEL: AssertColumns<ApiPollAuthorDTO, User> = true;

const REFUSALS = {
  update: {
    notYours: 'Not allowed to edit this poll',
    tooLate: 'A poll can only be edited while it is pending',
  },
  delete: {
    notYours: 'Not allowed to delete this poll',
    tooLate: 'A poll can only be deleted while it is pending',
  },
} as const;

type ListedPoll = Prisma.PollGetPayload<{ select: typeof LIST_SELECT }>;
type DetailedPoll = Prisma.PollGetPayload<{ select: typeof DETAIL_SELECT }>;

type Answer = { value: string; voters: number };

function readsAsNumbers(answers: Answer[]): boolean {
  return answers.every((answer) => isFinite(Number(answer.value)));
}

function ordered(answers: Answer[]): Answer[] {
  const numeric = readsAsNumbers(answers);

  return [...answers].sort((left, right) =>
    numeric
      ? Number(left.value) - Number(right.value)
      : left.value.localeCompare(right.value),
  );
}

function summarise(answers: Answer[], truncated: boolean) {
  if (truncated || answers.length === 0 || !readsAsNumbers(answers)) {
    return { average: null, min: null, max: null };
  }

  const values = answers.map((answer) => Number(answer.value));
  const voters = answers.reduce((total, answer) => total + answer.voters, 0);
  const sum = answers.reduce(
    (total, answer) => total + Number(answer.value) * answer.voters,
    0,
  );

  return {
    average: sum / voters,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

@Injectable()
export class ApiPollsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  async findAllPolls(
    query: ApiPollQueryDTO,
    caller: User,
  ): Promise<ApiPollPageDTO> {
    const ability = this.abilityFactory.createForUser(caller);
    assertLimitAllowed(query, ability);

    const where: Prisma.PollWhereInput = {
      AND: [accessibleBy(ability, 'read').ofType('Poll'), matching(query)],
      type: { in: ApiPollOfferedTypeSchema.options },
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.poll.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { id: 'desc' },
        skip: skipFor(query),
        take: query.limit,
      }),
      this.prisma.poll.count({ where }),
    ]);
    assertPageWithin(query, total);

    return ApiPollPageSchema.parse({
      data: rows.map((row) => this.listed(row)),
      ...pageMeta(query, total),
    });
  }

  async findOnePoll(id: number, caller: User): Promise<ApiPollDTO> {
    const ability = this.abilityFactory.createForUser(caller);
    const viewer = viewerOf(caller, ability);

    return this.detailed(await this.readable(id, viewer), viewer);
  }

  async findPollResults(id: number, caller: User): Promise<ApiPollResultsDTO> {
    const ability = this.abilityFactory.createForUser(caller);
    const poll = await this.readable(id, viewerOf(caller, ability));

    return poll.type === PollType.slider
      ? this.sliderResults(poll)
      : this.choiceResults(poll);
  }

  async createPoll(body: ApiPollCreateDTO, caller: User): Promise<ApiPollDTO> {
    const ability = this.abilityFactory.createForUser(caller);
    const viewer = viewerOf(caller, ability);
    const { options, roomId, ...poll } = body;

    if (roomId !== undefined && roomId !== null) {
      await this.assertRoomAcceptsPolls(roomId, ability, caller.id);
    }

    const created = await this.prisma.poll.create({
      data: {
        ...poll,
        roomId: roomId ?? null,
        status: PollStatus.pending,
        createdById: caller.id,
        options: { create: options },
      },
      select: DETAIL_SELECT,
    });

    return this.detailed(created, viewer);
  }

  async updatePoll(
    id: number,
    body: ApiPollUpdateDTO,
    caller: User,
  ): Promise<ApiPollDTO> {
    const ability = this.abilityFactory.createForUser(caller);
    const viewer = viewerOf(caller, ability);
    const poll = await this.readable(id, viewer);

    this.assertAllowed('update', poll, ability);

    const updated = await this.prisma.poll.update({
      where: { id },
      data: body,
      select: DETAIL_SELECT,
    });

    return this.detailed(updated, viewer);
  }

  async removePoll(id: number, caller: User): Promise<void> {
    const ability = this.abilityFactory.createForUser(caller);
    const viewer = viewerOf(caller, ability);
    const poll = await this.readable(id, viewer);

    this.assertAllowed('delete', poll, ability);

    if (poll.deletedAt !== null) {
      return;
    }

    await this.prisma.poll.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async choiceResults(poll: DetailedPoll): Promise<ApiPollResultsDTO> {
    const [voters, perOption] = await this.prisma.$transaction((tx) =>
      Promise.all([
        tx.vote.count({ where: { pollId: poll.id, deletedAt: null } }),
        tx.voteOption.groupBy({
          by: ['optionId'],
          where: {
            option: { pollId: poll.id, deletedAt: null },
            vote: { deletedAt: null },
          },
          orderBy: { optionId: 'asc' },
          _count: { _all: true },
        }),
      ]),
    );

    const counted = new Map(
      perOption.map((row) => [row.optionId, row._count._all]),
    );

    return ApiPollResultsSchema.parse({
      type: poll.type,
      voters,
      options: poll.options.map((option) => ({
        optionId: option.id,
        text: option.text,
        voters: counted.get(option.id) ?? 0,
      })),
    });
  }

  private async sliderResults(poll: DetailedPoll): Promise<ApiPollResultsDTO> {
    const [voters, perAnswer] = await this.prisma.$transaction((tx) =>
      Promise.all([
        tx.vote.count({ where: { pollId: poll.id, deletedAt: null } }),
        tx.vote.groupBy({
          by: ['freeField'],
          where: { pollId: poll.id, deletedAt: null, freeField: { not: null } },
          orderBy: { _count: { freeField: 'desc' } },
          take: MAX_DISTRIBUTION + 1,
          _count: { _all: true },
        }),
      ]),
    );

    const answers: Answer[] = perAnswer.map((row) => ({
      value: row.freeField as string,
      voters: row._count._all,
    }));
    const truncated = answers.length > MAX_DISTRIBUTION;
    const distribution = ordered(answers.slice(0, MAX_DISTRIBUTION));

    return ApiPollResultsSchema.parse({
      type: poll.type,
      voters,
      ...summarise(distribution, truncated),
      truncated,
      distribution,
    });
  }

  private async readable(id: number, viewer: Viewer): Promise<DetailedPoll> {
    const poll = await this.prisma.poll.findFirst({
      where: {
        AND: [
          accessibleBy(viewer.ability, 'read').ofType('Poll'),
          { id, type: { in: ApiPollOfferedTypeSchema.options } },
        ],
      },
      select: DETAIL_SELECT,
    });

    if (!poll) {
      throw new NotFoundException('Poll not found');
    }

    return poll;
  }

  private async assertRoomAcceptsPolls(
    roomId: number,
    ability: AppAbility,
    userId: number,
  ): Promise<void> {
    const room = await this.prisma.room.findFirst({
      where: {
        AND: [accessibleBy(ability, 'read').ofType('Room'), { id: roomId }],
      },
      // `roomMembers` is scoped to the caller so the `create Poll` rule can
      // see whether they belong to the room — non-members can't file polls.
      select: {
        id: true,
        status: true,
        deletedAt: true,
        roomMembers: {
          where: { userId, deletedAt: null },
          select: { userId: true, deletedAt: true },
        },
      },
    });

    const filedThere = subject('Poll', { roomId, room } as unknown as Poll);

    if (!room || ability.cannot('create', filedThere)) {
      throw new ForbiddenException('This room does not accept new polls');
    }
  }

  private assertAllowed(
    action: keyof typeof REFUSALS,
    poll: DetailedPoll,
    ability: AppAbility,
  ): void {
    if (ability.can(action, subject('Poll', poll))) {
      return;
    }

    const refusal = REFUSALS[action];
    const blockedByStatusOnly = ability.can(
      action,
      subject('Poll', { ...poll, status: PollStatus.pending }),
    );

    throw blockedByStatusOnly
      ? new ConflictException(refusal.tooLate)
      : new ForbiddenException(refusal.notYours);
  }

  private listed(row: ListedPoll) {
    const { _count, ...columns } = row;
    return {
      ...columns,
      createdBy: authorOnFeed(row),
      voterCount: _count.votes,
    };
  }

  private detailed(row: DetailedPoll, viewer: Viewer): ApiPollDTO {
    const { _count, ...columns } = row;
    return ApiPollSchema.parse({
      ...columns,
      createdBy: authorOf(row, viewer),
      voterCount: _count.votes,
    });
  }
}
