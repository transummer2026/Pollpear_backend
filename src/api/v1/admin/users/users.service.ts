// src/api/v1/admin/users/users.service.ts
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { MeService } from 'src/me/me.service';
import type { User } from 'src/generated/prisma/client';
import { isAdmin } from '../../common/abilities';
import { activeBan, liftedBan } from '../../common/bans';
import { publicMedia } from '../../common/media';
import { selectOf, type AssertColumns } from '../../common/select';
import {
  ApiAdminUserColumnsSchema,
  ApiAdminUserSchema,
  ApiModerationUserColumnsSchema,
  ApiModerationUserSchema,
  type ApiAdminUserColumnsDTO,
  type ApiAdminUserDTO,
  type ApiAdminUserUpdateDTO,
  type ApiModerationUserDTO,
} from '../../common/schemas/api-admin.schema';

const ADMIN_SELECT = selectOf(ApiAdminUserColumnsSchema);

export const ADMIN_MATCHES_MODEL: AssertColumns<ApiAdminUserColumnsDTO, User> =
  true;

const MODERATION_SELECT = selectOf(ApiModerationUserColumnsSchema);

/**
 * Lifetime totals, straight from prisma _count. The matching figures for what
 * still counts today cannot ride along: _count keys are relation names, so one
 * relation cannot be counted twice under two filters. They are counted beside
 * it instead, batched into the same round trip.
 */
const MODERATION_COUNTS = {
  pollsCreated: true,
  roomsCreated: true,
  votes: true,
  messages: true,
  bansReceived: true,
  reportsGiven: true,
  reportsReceived: true,
} as const;

const ADMIN_COUNTS = { ...MODERATION_COUNTS, apiKeys: true } as const;

type ModerationTotals = {
  pollsCreated: number;
  roomsCreated: number;
  votes: number;
  messages: number;
  bansReceived: number;
  reportsGiven: number;
  reportsReceived: number;
};

type StillCounting = {
  polls: number;
  rooms: number;
  votes: number;
  messages: number;
  bansActive: number;
  bansLifted: number;
};

/**
 * Pairs each lifetime total with what is still live. Subtracting the two is
 * only sound where a row has one way of ending: a poll is deleted or it is
 * not. A ban has two, so what a moderator lifted by hand is counted rather
 * than deduced, otherwise a sentence that simply ran its course would be
 * reported as one somebody cancelled.
 */
function moderationCounts(total: ModerationTotals, live: StillCounting) {
  return {
    pollsCreated: {
      total: total.pollsCreated,
      active: live.polls,
      deleted: total.pollsCreated - live.polls,
    },
    roomsCreated: {
      total: total.roomsCreated,
      active: live.rooms,
      deleted: total.roomsCreated - live.rooms,
    },
    votes: {
      total: total.votes,
      active: live.votes,
      deleted: total.votes - live.votes,
    },
    messages: {
      total: total.messages,
      active: live.messages,
      deleted: total.messages - live.messages,
    },
    bansReceived: {
      total: total.bansReceived,
      active: live.bansActive,
      lifted: live.bansLifted,
    },
    reportsGiven: total.reportsGiven,
    reportsReceived: total.reportsReceived,
  };
}

@Injectable()
export class ApiAdminUserService {
  private readonly logger = new Logger(ApiAdminUserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly meService: MeService,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  /**
   * Unlike the public routes, this one sees deleted and private accounts:
   * moderating what is hidden is the whole point. What it returns depends on
   * the caller: a moderator gets conduct, an admin also gets the person and
   * the credentials, and pays two extra counts for them.
   */
  async findOneUser(
    id: number,
    caller: User,
  ): Promise<ApiAdminUserDTO | ApiModerationUserDTO> {
    return isAdmin(this.abilityFactory.createForUser(caller))
      ? await this.adminRecord(id)
      : await this.moderationRecord(id);
  }

  /**
   * The counts both records share, as statements meant to be batched into the
   * caller's own transaction: read outside it they could contradict the row
   * they describe.
   */
  private stillCounting(id: number) {
    return [
      this.prisma.poll.count({ where: { createdById: id, deletedAt: null } }),
      this.prisma.room.count({ where: { createdById: id, deletedAt: null } }),
      this.prisma.vote.count({ where: { createdById: id, deletedAt: null } }),
      this.prisma.message.count({ where: { authorId: id, deletedAt: null } }),
      this.prisma.ban.count({ where: { userId: id, ...activeBan() } }),
      this.prisma.ban.count({ where: { userId: id, ...liftedBan() } }),
    ] as const;
  }

  private async moderationRecord(id: number): Promise<ApiModerationUserDTO> {
    const [user, polls, rooms, votes, messages, bansActive, bansLifted] =
      await this.prisma.$transaction([
        this.prisma.user.findUnique({
          where: { id },
          select: {
            ...MODERATION_SELECT,
            _count: { select: MODERATION_COUNTS },
          },
        }),
        ...this.stillCounting(id),
      ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { _count, ...columns } = user;
    return ApiModerationUserSchema.parse({
      ...columns,
      avatarUrl: publicMedia(columns.avatarUrl),
      bannerUrl: publicMedia(columns.bannerUrl),
      counts: moderationCounts(_count, {
        polls,
        rooms,
        votes,
        messages,
        bansActive,
        bansLifted,
      }),
    });
  }

  private async adminRecord(id: number): Promise<ApiAdminUserDTO> {
    const now = new Date();
    const [
      user,
      polls,
      rooms,
      votes,
      messages,
      bansActive,
      bansLifted,
      keysActive,
      keysRevoked,
    ] = await this.prisma.$transaction([
      this.prisma.user.findUnique({
        where: { id },
        select: { ...ADMIN_SELECT, _count: { select: ADMIN_COUNTS } },
      }),
      ...this.stillCounting(id),
      this.prisma.apiKey.count({
        where: { ownerId: id, revoked: false, expiredAt: { gt: now } },
      }),
      this.prisma.apiKey.count({ where: { ownerId: id, revoked: true } }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { _count, ...columns } = user;
    return ApiAdminUserSchema.parse({
      ...columns,
      avatarUrl: publicMedia(columns.avatarUrl),
      bannerUrl: publicMedia(columns.bannerUrl),
      counts: {
        ...moderationCounts(_count, {
          polls,
          rooms,
          votes,
          messages,
          bansActive,
          bansLifted,
        }),
        apiKeys: {
          total: _count.apiKeys,
          active: keysActive,
          revoked: keysRevoked,
        },
      },
    });
  }

  /**
   * Every field of the body is checked against the caller's own rules, and one
   * field they may not touch refuses the whole call: a body half applied would
   * leave the account in a state nobody asked for.
   */
  async updateUser(
    id: number,
    body: ApiAdminUserUpdateDTO,
    caller: User,
  ): Promise<ApiAdminUserDTO | ApiModerationUserDTO> {
    const ability = this.abilityFactory.createForUser(caller);

    const forbiddenFields = Object.keys(body).filter(
      (field) =>
        !ability.can('manage', 'User', field) &&
        !ability.can('moderate', 'User', field),
    );
    if (forbiddenFields.length > 0) {
      throw new ForbiddenException(
        `Not allowed to change: ${forbiddenFields.join(', ')}`,
      );
    }

    await this.prisma.user.update({ where: { id }, data: body });
    this.logger.log(
      `${caller.role} ${caller.id} updated user ${id}: ${Object.keys(body).join(', ')}`,
    );

    return isAdmin(ability)
      ? await this.adminRecord(id)
      : await this.moderationRecord(id);
  }

  /**
   * Same account lifecycle as a self deletion: keys revoked, sockets closed.
   * An admin removing someone must not leave that account's api keys alive,
   * which is also why updateUser cannot set deletedAt to a date.
   */
  async removeUser(id: number, caller: User): Promise<void> {
    await this.meService.remove(id);
    this.logger.warn(`${caller.role} ${caller.id} deleted user ${id}`);
  }
}
