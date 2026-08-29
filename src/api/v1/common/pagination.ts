// src/api/v1/common/pagination.ts
import { BadRequestException } from '@nestjs/common';
import { subject } from '@casl/ability';
import type { AppAbility } from 'src/casl/casl-prisma';
import type { User } from 'src/generated/prisma/client';
import {
  LIMIT_BY_ROLE,
  skipFor,
  type ApiPageQueryDTO,
} from './schemas/api-pagination.schema';

/**
 * Le palier se lit sur la politique, jamais sur un nom de role. Bannir un
 * moderateur n'est donne qu'a l'admin, bannir un compte ordinaire l'est aussi
 * au moderateur : ces deux questions suffisent a separer les trois paliers, et
 * l'ordre compte puisque l'admin repond oui aux deux.
 */
const A_MODERATOR = subject('User', { role: 'moderator' } as User);
const A_PLAIN_USER = subject('User', { role: 'user' } as User);

export function maxLimitFor(ability: AppAbility): number {
  if (ability.can('ban', A_MODERATOR)) return LIMIT_BY_ROLE.admin;
  if (ability.can('ban', A_PLAIN_USER)) return LIMIT_BY_ROLE.moderator;
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
