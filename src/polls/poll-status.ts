import type { Poll, Prisma, Room } from 'src/generated/prisma/client';
import type { PrismaService } from 'src/prisma/prisma.service';
import { roomHasEnded } from 'src/rooms/room-status';

type PollStatus = Poll['status'];

/**
 * A poll carries the same pair of end-of-life signals as a room: `endsAt`
 * (the planned end — non-nullable here, every poll has one) and `status`
 * (`'pending' | 'active' | 'closed'`, the persisted state). `pending` flips
 * to `active` on the first vote; before this module nothing ever wrote
 * `closed`, so a poll past its `endsAt` kept reading `active` on the row
 * forever. The client never writes `status`; the backend owns it.
 *
 * `pollHasEnded` — the poll is past its own scheduled end.
 * `nextPollStatus` — the status a poll should show, folding in its parent
 *   room: a poll in a closed room reads `closed` too, matching the CASL
 *   vote rules that gate on `room.status`.
 * `syncPollStatuses` — reconcile rows the backend has just loaded. A
 *   closure is *persisted* only when it is terminal: the poll's own
 *   `endsAt` has lapsed, or its room's has (neither ever comes back). A
 *   room an owner merely closed by hand, with its `endsAt` still ahead,
 *   can be reopened — that closure is reflected in the returned rows but
 *   not written, so the poll revives with the room on the next read.
 * `closeExpiredPolls` — the periodic bulk sweep for polls no request
 *   touches again.
 */
export function pollHasEnded(
  endsAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  return endsAt != null && endsAt.getTime() <= now.getTime();
}

type RoomEndState = { status?: Room['status']; endsAt?: Date | null };

/** Whether a poll should read `closed` — on its own account or its room's. */
function pollIsOver(
  poll: {
    status?: PollStatus;
    endsAt: Date | null | undefined;
    room?: RoomEndState | null;
  },
  now: Date,
): boolean {
  if (poll.status === 'closed') return true;
  if (pollHasEnded(poll.endsAt, now)) return true;
  const room = poll.room;
  return (
    room != null && (room.status === 'closed' || roomHasEnded(room.endsAt, now))
  );
}

export function nextPollStatus(
  poll: {
    status?: PollStatus;
    endsAt: Date | null | undefined;
    room?: RoomEndState | null;
  },
  now: Date = new Date(),
): PollStatus {
  return pollIsOver(poll, now) ? 'closed' : (poll.status ?? 'active');
}

/**
 * Whether a poll's closure is terminal — safe to write to the row. True
 * when the poll's own `endsAt` has lapsed, or its room's: neither is
 * reversible. A room an owner closed by hand while its `endsAt` is still
 * ahead is *not* terminal (they can reopen it), so that closure stays a
 * derived view only.
 */
function pollClosureIsTerminal(
  poll: { endsAt: Date | null | undefined; room?: RoomEndState | null },
  now: Date,
): boolean {
  return pollHasEnded(poll.endsAt, now) || roomHasEnded(poll.room?.endsAt, now);
}

export type SyncablePoll = {
  id: number;
  status: PollStatus;
  endsAt: Date | null;
  room?: RoomEndState | null;
};

/**
 * Rewrites `status` to `'closed'` on every passed poll that is over while
 * the row still says otherwise. Terminal closures (a lapsed `endsAt`, the
 * poll's own or its room's) are written through in a single `updateMany`;
 * a room merely closed by hand is reflected in the returned rows only.
 * A no-op (no query, same array back) when nothing is over — the common
 * case — so it stays cheap to call on read paths.
 */
export async function syncPollStatuses<T extends SyncablePoll>(
  prisma: Pick<PrismaService, 'poll'>,
  polls: T[],
  now: Date = new Date(),
): Promise<T[]> {
  const closing = polls.filter(
    (poll) => poll.status !== 'closed' && pollIsOver(poll, now),
  );
  if (closing.length === 0) return polls;

  const terminalIds = closing
    .filter((poll) => pollClosureIsTerminal(poll, now))
    .map((poll) => poll.id);

  if (terminalIds.length > 0) {
    await prisma.poll.updateMany({
      where: { id: { in: terminalIds }, status: { not: 'closed' } },
      data: { status: 'closed' },
    } satisfies Prisma.PollUpdateManyArgs);
  }

  const closingIds = new Set(closing.map((poll) => poll.id));
  return polls.map((poll) =>
    closingIds.has(poll.id) ? { ...poll, status: 'closed' } : poll,
  );
}

/**
 * Bulk sweep with no rows in hand — the periodic backstop to
 * {@link syncPollStatuses}. Closes every non-deleted poll whose closure is
 * terminal (its own `endsAt` lapsed, or it sits in a room whose `endsAt`
 * has) and isn't already closed, in one query; returns how many rows
 * changed. Idempotent (`status: { not: 'closed' }`), so it is safe to run
 * on every instance.
 */
export async function closeExpiredPolls(
  prisma: Pick<PrismaService, 'poll'>,
  now: Date = new Date(),
): Promise<number> {
  const { count } = await prisma.poll.updateMany({
    where: {
      status: { not: 'closed' },
      deletedAt: null,
      OR: [
        { endsAt: { lte: now } },
        { room: { is: { endsAt: { not: null, lte: now } } } },
      ],
    },
    data: { status: 'closed' },
  } satisfies Prisma.PollUpdateManyArgs);
  return count;
}
