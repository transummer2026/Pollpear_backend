// src/api/v1/users/users.visibility.ts
import type { Prisma } from 'src/generated/prisma/client';
import { activeBan } from '../common/bans';
import { publicMedia } from '../common/media';
import type { Viewer } from '../common/viewer';
import type { ApiUserStateDTO } from '../common/schemas/api-users.schema';

/**
 * What a caller is allowed to see, widened by role. Listed accounts are the
 * ones that opted in, named value by value rather than as "not private", so
 * a visibility added to the enum later stays out until someone decides it
 * belongs. Blocks never filter: hiding the accounts that blocked you would
 * let you deduce the block from the gap they leave. Only the accounts you
 * blocked yourself are flagged, which is your own doing.
 */
export function visibleTo(viewer: Viewer): Prisma.UserWhereInput {
  return {
    visibility: 'public',
    ...(viewer.canSeeDeleted ? {} : { deletedAt: null }),
    ...(viewer.canSeeBanned ? {} : { bansReceived: { none: activeBan() } }),
  };
}

/**
 * The extra columns needed to compute state, never returned as such.
 */
export const VIEWER_SELECT = (viewerId: number) => ({
  deletedAt: true as const,
  bansReceived: { where: activeBan(), select: { id: true }, take: 1 },
  blocksReceived: {
    where: { blockerId: viewerId },
    select: { id: true },
    take: 1,
  },
});

type StateColumns = {
  deletedAt: Date | null;
  bansReceived: { id: number }[];
  blocksReceived: { id: number }[];
};

export function stateOf(
  row: StateColumns,
  viewer: Viewer,
): ApiUserStateDTO | undefined {
  if (viewer.canSeeDeleted && row.deletedAt !== null) return 'deleted';
  if (viewer.canSeeBanned && row.bansReceived.length > 0) return 'banned';
  if (row.blocksReceived.length > 0) return 'blocked';
  return undefined;
}

/**
 * Turns a row read with VIEWER_SELECT into what a payload may carry: the
 * three bookkeeping columns become a state, and a media path that is not a
 * public url becomes null. Both list and profile go through here, so a
 * caller can never be told more on one route than on the other.
 */
export function presentUser<
  Row extends StateColumns & { avatarUrl: string | null },
>(row: Row, viewer: Viewer) {
  const { deletedAt, bansReceived, blocksReceived, ...columns } = row;
  return {
    ...columns,
    avatarUrl: publicMedia(row.avatarUrl),
    state: stateOf({ deletedAt, bansReceived, blocksReceived }, viewer),
  };
}
