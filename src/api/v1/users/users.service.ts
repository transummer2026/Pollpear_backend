// src/api/v1/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { accessibleBy } from 'src/casl/casl-prisma';
import { PrismaService } from 'src/prisma/prisma.service';
import { presentUser, VIEWER_SELECT } from './users.visibility';
import { viewerOf } from '../common/viewer';
import {
  assertLimitAllowed,
  assertPageWithin,
  pageMeta,
} from '../common/pagination';
import { selectOf, type AssertColumns } from '../common/select';
import type { Prisma, User } from 'src/generated/prisma/client';
import {
  ApiUserListColumnsSchema,
  ApiUserPageSchema,
  type ApiUserListColumnsDTO,
  type ApiUserPageDTO,
} from '../common/schemas/api-users.schema';
import {
  skipFor,
  type ApiPageQueryDTO,
} from '../common/schemas/api-pagination.schema';

const LIST_SELECT = selectOf(ApiUserListColumnsSchema);
export const LIST_MATCHES_MODEL: AssertColumns<ApiUserListColumnsDTO, User> =
  true;

/**
 * Only accounts that agreed to be listed are visible here: soft deleted and
 * private ones are filtered on every query, so a private profile answers 404
 * rather than telling a stranger it exists.
 */
@Injectable()
export class ApiUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  async findAllUsers(
    query: ApiPageQueryDTO,
    caller: User,
  ): Promise<ApiUserPageDTO> {
    const ability = this.abilityFactory.createForUser(caller);
    assertLimitAllowed(query, ability);

    const viewer = viewerOf(caller);
    const where: Prisma.UserWhereInput = accessibleBy(ability, 'read').ofType(
      'User',
    );

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: { ...LIST_SELECT, ...VIEWER_SELECT(viewer.id) },
        orderBy: { id: 'asc' },
        skip: skipFor(query),
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    assertPageWithin(query, total);

    return ApiUserPageSchema.parse({
      data: rows.map((row) => presentUser(row)),
      ...pageMeta(query, total),
    });
  }
}
