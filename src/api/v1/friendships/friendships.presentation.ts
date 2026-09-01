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
 * The row stores the pair in a canonical order, which carries no meaning of
 * its own. `addresseeId` names the side that has to answer; the other side is
 * therefore the one who asked. That pair of roles is what the payload exposes.
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
