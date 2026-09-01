import { BadRequestException } from '@nestjs/common';
import type { User } from 'src/generated/prisma/client';
import {
  LIMIT_BY_ROLE,
  skipFor,
  type ApiPageQueryDTO,
} from './schemas/api-pagination.schema';

/**
 * LIMIT_BY_ROLE is keyed by role, so the role is read straight off the caller.
 * Deriving it from the policy instead would mean picking some role-graded
 * permission to probe, which couples the page size to whichever rule happens
 * to separate the tiers today.
 */
export function maxLimitFor(caller: User): number {
  return LIMIT_BY_ROLE[caller.role];
}

/**
 * Refuses a page larger than the caller's role allows, rather than trimming
 * it: a trimmed page looks like the end of the list to whoever asked.
 */
export function assertLimitAllowed(query: ApiPageQueryDTO, caller: User): void {
  const max = maxLimitFor(caller);
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
