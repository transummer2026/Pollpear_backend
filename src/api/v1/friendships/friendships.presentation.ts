// src/api/v1/friendships/friendships.presentation.ts
import type { Prisma } from 'src/generated/prisma/client';
import type { ApiUserSummaryDTO } from '../common/schemas/api-users.schema';
import type { ApiFriendshipQueryDTO } from '../common/schemas/api-friendships.schema';

export function matching(
  filter: ApiFriendshipQueryDTO,
): Prisma.FriendshipWhereInput {
  return {
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.with
      ? { OR: [{ userAId: filter.with }, { userBId: filter.with }] }
      : {}),
  };
}

/**
 * La ligne range la paire dans un ordre canonique, qui ne porte aucun sens.
 * `addresseeId` designe celui qui doit repondre; l'autre est donc celui qui a
 * demande. C'est ce couple de roles que le payload expose.
 */
export function parties<
  Row extends {
    addresseeId: number;
    userA: ApiUserSummaryDTO;
    userB: ApiUserSummaryDTO;
  },
>(row: Row): { requester: ApiUserSummaryDTO; addressee: ApiUserSummaryDTO } {
  const addresseeIsA = row.userA.id === row.addresseeId;

  return {
    requester: addresseeIsA ? row.userB : row.userA,
    addressee: addresseeIsA ? row.userA : row.userB,
  };
}
