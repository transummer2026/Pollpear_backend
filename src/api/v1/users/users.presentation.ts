// src/api/v1/users/users.presentation.ts
import { publicMedia } from '../common/media';
import type { ApiUserStateDTO } from '../common/schemas/api-users.schema';

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

function stateOf(row: StateColumns): ApiUserStateDTO | undefined {
  return row.blocksReceived.length > 0 ? 'blocked' : undefined;
}

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
