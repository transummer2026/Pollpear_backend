// src/api/v1/common/pagination.ts
import { BadRequestException } from '@nestjs/common';
import type { AppAbility } from 'src/casl/casl-prisma';
import { isAdmin, isStaff } from './abilities';
import {
  LIMIT_BY_ROLE,
  skipFor,
  type ApiPageQueryDTO,
} from './schemas/api-pagination.schema';

export function maxLimitFor(ability: AppAbility): number {
  if (isAdmin(ability)) return LIMIT_BY_ROLE.admin;
  if (isStaff(ability)) return LIMIT_BY_ROLE.moderator;
  return LIMIT_BY_ROLE.user;
}

/**
 * Refuses a page larger than the caller's role allows, rather than trimming
 * it: a trimmed page looks like the end of the list to whoever asked.
 */
export function assertLimitAllowed(
  query: ApiPageQueryDTO,
  ability: AppAbility,
): void {
  const max = maxLimitFor(ability);
  if (query.limit > max) {
    throw new BadRequestException(`limit is capped at ${max} for this key`);
  }
}

/**
 * Refuses a page past the last one. The cost of pagination sits in the offset,
 * which postgres has to produce and throw away before returning anything, so
 * a page nobody can fill is work nobody asked for. Page 1 always stands, even
 * on an empty list, so a client can always make a first call.
 */
export function assertPageWithin(query: ApiPageQueryDTO, total: number): void {
  if (query.page > 1 && skipFor(query) >= total) {
    throw new BadRequestException(
      `page ${query.page} is past the last one, ${total} rows in total`,
    );
  }
}

/**
 * The envelope fields that describe the page rather than its contents. Every
 * paginated route answers the same three, so they are built in one place.
 */
export function pageMeta(query: ApiPageQueryDTO, total: number) {
  return { page: query.page, limit: query.limit, total };
}
