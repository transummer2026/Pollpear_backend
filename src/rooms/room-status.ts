import type { Prisma, Room } from 'src/generated/prisma/client';
import type { PrismaService } from 'src/prisma/prisma.service';

/**
 * A room carries two end-of-life signals: `endsAt` (the planned end, set by
 * the owner at creation) and `status` (`'active' | 'closed'`, the persisted
 * state every gate actually reads — the CASL room rules, poll creation, vote
 * eligibility). The client never writes `status`; the backend owns it and
 * keeps it in sync with `endsAt`. The two drift on their own: a room whose
 * `endsAt` has passed still sits at `status: 'active'` in the row until
 * something rewrites it.
 *
 * `roomHasEnded` is the single definition of "past its scheduled end".
 * `nextRoomStatus` is the `status` a row should have given its `endsAt`.
 * `syncRoomStatuses` persists that for rows the backend has just loaded or
 * is about to act on. Closing is one-way here: a lapsed `endsAt` never
 * reopens a room, and an already-`closed` room stays closed.
 */
export function roomHasEnded(
  endsAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  return endsAt != null && endsAt.getTime() <= now.getTime();
}

export function nextRoomStatus(
  room: { status?: Room['status']; endsAt: Date | null | undefined },
  now: Date = new Date(),
): Room['status'] {
  return room.status === 'closed' || roomHasEnded(room.endsAt, now)
    ? 'closed'
    : 'active';
}

type SyncableRoom = { id: number; status: Room['status']; endsAt: Date | null };

/**
 * Rewrites `status` to `'closed'` on every passed room whose `endsAt` has
 * lapsed while the row still says `'active'`, in a single `updateMany`, then
 * returns the rows with that change reflected in memory so the caller's
 * response matches the row without a re-fetch. A no-op (no query) when
 * nothing has expired, which is the common case — so calling it on read
 * paths only writes when a room has just crossed its end.
 */
export async function syncRoomStatuses<T extends SyncableRoom>(
  prisma: Pick<PrismaService, 'room'>,
  rooms: T[],
  now: Date = new Date(),
): Promise<T[]> {
  const staleIds = rooms
    .filter(
      (room) =>
        nextRoomStatus(room, now) === 'closed' && room.status === 'active',
    )
    .map((room) => room.id);

  if (staleIds.length === 0) return rooms;

  await prisma.room.updateMany({
    where: { id: { in: staleIds }, status: 'active' },
    data: { status: 'closed' },
  } satisfies Prisma.RoomUpdateManyArgs);

  const stale = new Set(staleIds);
  return rooms.map((room) =>
    stale.has(room.id) ? { ...room, status: 'closed' } : room,
  );
}

/**
 * Bulk equivalent of {@link syncRoomStatuses} with no rows in hand: flips
 * every still-`active`, non-deleted room whose `endsAt` has lapsed to
 * `status: 'closed'` in one query, and returns how many rows were closed.
 * `syncRoomStatuses` self-heals a room the moment anyone touches it; this
 * is the periodic sweep for rooms no request ever touches again. Idempotent
 * (`where: { status: 'active' }`), so it's safe to run on every instance.
 */
export async function closeExpiredRooms(
  prisma: Pick<PrismaService, 'room'>,
  now: Date = new Date(),
): Promise<number> {
  const { count } = await prisma.room.updateMany({
    where: {
      status: 'active',
      deletedAt: null,
      endsAt: { not: null, lte: now },
    },
    data: { status: 'closed' },
  } satisfies Prisma.RoomUpdateManyArgs);
  return count;
}
