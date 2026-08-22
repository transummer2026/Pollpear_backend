// src/api/v1/admin/staff/staff.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import {
  assertLimitAllowed,
  assertPageWithin,
  pageMeta,
} from '../../common/pagination';
import { UserRole } from 'src/generated/prisma/enums';
import type { User } from 'src/generated/prisma/client';
import { publicMedia } from '../../common/media';
import { selectOf, type AssertColumns } from '../../common/select';
import {
  ApiStaffListItemSchema,
  ApiStaffPageSchema,
  type ApiStaffListItemDTO,
  type ApiStaffPageDTO,
} from '../../common/schemas/api-admin.schema';
import {
  skipFor,
  type ApiPageQueryDTO,
} from '../../common/schemas/api-pagination.schema';

const STAFF_SELECT = selectOf(ApiStaffListItemSchema);
export const STAFF_MATCHES_MODEL: AssertColumns<ApiStaffListItemDTO, User> =
  true;

/**
 * Which roles count as staff, spelled out one by one: satisfies makes a new
 * role a compile error here, rather than an account silently missing from
 * the staff list.
 */
const IS_STAFF = {
  admin: true,
  moderator: true,
  user: false,
} satisfies Record<UserRole, boolean>;

const STAFF_ROLES = (Object.keys(IS_STAFF) as UserRole[]).filter(
  (role) => IS_STAFF[role],
);

@Injectable()
export class ApiAdminStaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  /**
   * Lists the accounts that hold a staff role. Deleted ones are kept out:
   * a revoked moderator is not staff any more.
   */
  async findStaff(
    query: ApiPageQueryDTO,
    caller: User,
  ): Promise<ApiStaffPageDTO> {
    const ability = this.abilityFactory.createForUser(caller);
    assertLimitAllowed(query, ability);

    const where = { role: { in: STAFF_ROLES }, deletedAt: null };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: STAFF_SELECT,
        orderBy: { id: 'asc' },
        skip: skipFor(query),
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    assertPageWithin(query, total);

    return ApiStaffPageSchema.parse({
      data: rows.map((row) => ({
        ...row,
        avatarUrl: publicMedia(row.avatarUrl),
      })),
      ...pageMeta(query, total),
    });
  }
}
