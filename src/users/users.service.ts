import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { randomUUID } from 'crypto';
import {
  type UserDTO,
  UserSchema,
  type UserPublicProfileDTO,
  UserPublicProfileSchema,
  type UserUpdateDTO,
} from 'Pollpear_shared/src/schemas/users.schema';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { accessibleBy } from 'src/casl/casl-prisma';
import { ForbiddenError, subject } from '@casl/ability';
import {
  SEARCH_RESULTS_LIMIT,
  type SearchOptions,
} from 'src/search/search-options';
import type { Prisma, User } from 'src/generated/prisma/client';

const SEARCH_SELECT = {
  id: true,
  username: true,
  name: true,
  surname: true,
  avatarUrl: true,
} as const;

type UserSearchRow = {
  id: number;
  username: string;
  name: string | null;
  surname: string | null;
  avatarUrl: string;
};

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private abilityFactory: CaslAbilityFactory,
  ) {}

  /**
   * Prefix matches on username rank first (the "find that exact friend"
   * case), then contains matches on username/name/surname fill the rest:
   * Prisma has no relevance-ordered ORDER BY without raw SQL. Pagination
   * walks the two phases with `skip`/`take` so page N stays consistent
   * with page N-1 instead of re-deriving the ranking from scratch. The
   * readable scope is derived from the CASL User-read policy via
   * `accessibleBy` instead of re-encoding it, so search stays in sync
   * with whatever that policy allows (public users, plus the requester's
   * own profile).
   */
  async search(
    q: string,
    viewer: User,
    {
      page = 1,
      limit = SEARCH_RESULTS_LIMIT,
      sortBy = 'relevance',
    }: SearchOptions = {},
  ) {
    const ability = this.abilityFactory.createForUser(viewer);
    // `readableBy` and the search-term filter each need their own `OR`;
    // composing them with `AND` (rather than spreading both into the same
    // object) keeps the two from colliding and silently dropping one.
    const readableBy: Prisma.UserWhereInput = accessibleBy(
      ability,
      'read',
    ).ofType('User');
    const baseWhere: Prisma.UserWhereInput = {
      deletedAt: null,
      AND: [readableBy],
    };
    const matchWhere: Prisma.UserWhereInput = {
      deletedAt: null,
      AND: [
        readableBy,
        {
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { surname: { contains: q, mode: 'insensitive' } },
          ],
        },
      ],
    };

    const total = await this.prisma.user.count({ where: matchWhere });
    const skip = (page - 1) * limit;

    if (sortBy === 'alphabetical') {
      const items = await this.prisma.user.findMany({
        where: matchWhere,
        select: SEARCH_SELECT,
        orderBy: { username: 'asc' },
        skip,
        take: limit,
      });
      return { items, total };
    }

    const startsWithFilter: Prisma.UserWhereInput = {
      username: { startsWith: q, mode: 'insensitive' },
    };
    const startsWithWhere: Prisma.UserWhereInput = {
      ...baseWhere,
      ...startsWithFilter,
    };
    const startsWithTotal = await this.prisma.user.count({
      where: startsWithWhere,
    });

    let items: UserSearchRow[] = [];
    if (skip < startsWithTotal) {
      items = await this.prisma.user.findMany({
        where: startsWithWhere,
        select: SEARCH_SELECT,
        orderBy: { username: 'asc' },
        skip,
        take: limit,
      });
    }

    const remaining = limit - items.length;
    if (remaining > 0) {
      const contains = await this.prisma.user.findMany({
        where: {
          ...matchWhere,
          NOT: startsWithFilter,
        },
        select: SEARCH_SELECT,
        orderBy: { username: 'asc' },
        skip: Math.max(0, skip - startsWithTotal),
        take: remaining,
      });
      items = [...items, ...contains];
    }

    return { items, total };
  }

  async findOne(id: number, viewer: User): Promise<UserPublicProfileDTO> {
    const ability = this.abilityFactory.createForUser(viewer);
    const user = await this.prisma.user.findFirst({
      where: {
        AND: [
          accessibleBy(ability, 'read').ofType('User'),
          { id, deletedAt: null },
        ],
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return UserPublicProfileSchema.parse(user);
  }

  async update(
    id: number,
    viewer: User,
    body: UserUpdateDTO,
  ): Promise<UserDTO> {
    const target = await this.prisma.user.findUniqueOrThrow({ where: { id } });

    const ability = this.abilityFactory.createForUser(viewer);
    ForbiddenError.from(ability).throwUnlessCan(
      'update',
      subject('User', target),
    );

    const updatedUser = await this.updateUserProfile(id, body);
    return UserSchema.parse(updatedUser);
  }

  remove(id: number) {
    return `remove user #${id} works`;
  }

  report(id: number) {
    return `report user #${id} works`;
  }

  // PRISMA REQUESTS

  async findByUserId(userId: number) {
    if (isNaN(userId)) throw new ForbiddenException('Invalid user id.');
    return await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
  }

  async findByEmail(email: string) {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }

  generateSessionId() {
    return randomUUID();
  }

  async updatePassword(userId: number, passwordHash: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async verifyEmail(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: true },
    });
  }

  async setOnline(userId: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isOnline: true },
    });
  }

  async setOffline(userId: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isOnline: false, lastSeenAt: new Date() },
    });
  }

  async resetOnlineStatus(): Promise<number> {
    const { count } = await this.prisma.user.updateMany({
      where: { isOnline: true },
      data: { isOnline: false },
    });
    return count;
  }

  private async updateUserProfile(userId: number, data: UserUpdateDTO) {
    return await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: data,
    });
  }
}
