import { publicMedia } from '../common/media';
import type { ApiUserStateDTO } from '../common/schemas/api-users.schema';

/**
 * The column read to decide the state, never returned as is. The filter only
 * covers the block the caller placed themselves: the policy already keeps the
 * accounts that blocked them out of the list, so there is nothing they can
 * infer from it.
 */
export const VIEWER_SELECT = (viewerId: number) => ({
  blocksReceived: {
    where: { blockerId: viewerId },
    select: { id: true },
    take: 1,
  },
});

type StateColumns = {
  blocksReceived: { id: number }[];
};

/**
 * Only one state remains possible. Deleted and private are not states to
 * report: accessibleBy keeps them out of the response, so an account in that
 * situation never reaches this point.
 */
export function stateOf(row: StateColumns): ApiUserStateDTO | undefined {
  return row.blocksReceived.length > 0 ? 'blocked' : undefined;
}

/**
 * Turns a row read with VIEWER_SELECT into what a payload may carry: the
 * bookkeeping column becomes a state, and a media path that is not a public
 * url becomes null. Both list and profile go through here, so a caller can
 * never be told more on one route than on the other.
 */
export function presentUser<
  Row extends StateColumns & { avatarUrl: string | null },
>(row: Row) {
  const { blocksReceived, ...columns } = row;
  return {
    ...columns,
    avatarUrl: publicMedia(row.avatarUrl),
    state: stateOf({ blocksReceived }),
  };
}
