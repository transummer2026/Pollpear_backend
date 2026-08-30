import { PrismaService } from 'src/prisma/prisma.service';
import {
  closeExpiredPolls,
  nextPollStatus,
  pollHasEnded,
  syncPollStatuses,
} from './poll-status';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const PAST = new Date('2026-06-15T11:59:59.000Z');
const FUTURE = new Date('2026-06-15T12:00:01.000Z');

describe('poll-status', () => {
  describe('pollHasEnded', () => {
    it('is false without an end date', () => {
      expect(pollHasEnded(null, NOW)).toBe(false);
      expect(pollHasEnded(undefined, NOW)).toBe(false);
    });

    it('is true once the end date is reached', () => {
      expect(pollHasEnded(PAST, NOW)).toBe(true);
      expect(pollHasEnded(NOW, NOW)).toBe(true);
      expect(pollHasEnded(FUTURE, NOW)).toBe(false);
    });
  });

  describe('nextPollStatus', () => {
    it('keeps a pending poll pending while it and its room are live', () => {
      expect(nextPollStatus({ status: 'pending', endsAt: FUTURE }, NOW)).toBe(
        'pending',
      );
    });

    it('keeps an active poll active while it and its room are live', () => {
      expect(
        nextPollStatus(
          { status: 'active', endsAt: FUTURE, room: { status: 'active' } },
          NOW,
        ),
      ).toBe('active');
    });

    it('closes a poll whose own end has passed, whatever its state', () => {
      expect(nextPollStatus({ status: 'active', endsAt: PAST }, NOW)).toBe(
        'closed',
      );
      expect(nextPollStatus({ status: 'pending', endsAt: PAST }, NOW)).toBe(
        'closed',
      );
    });

    it('closes a still-live poll whose room is closed', () => {
      expect(
        nextPollStatus(
          { status: 'active', endsAt: FUTURE, room: { status: 'closed' } },
          NOW,
        ),
      ).toBe('closed');
    });

    it("closes a still-live poll whose room's end has passed", () => {
      expect(
        nextPollStatus(
          {
            status: 'active',
            endsAt: FUTURE,
            room: { status: 'active', endsAt: PAST },
          },
          NOW,
        ),
      ).toBe('closed');
    });

    it('never reopens a closed poll', () => {
      expect(nextPollStatus({ status: 'closed', endsAt: FUTURE }, NOW)).toBe(
        'closed',
      );
    });
  });

  describe('syncPollStatuses', () => {
    const updateMany = jest.fn();
    const prisma = { poll: { updateMany } } as unknown as PrismaService;

    beforeEach(() => jest.clearAllMocks());

    it('does not query when nothing is over', async () => {
      const polls = [
        { id: 1, status: 'pending' as const, endsAt: FUTURE },
        {
          id: 2,
          status: 'active' as const,
          endsAt: FUTURE,
          room: { status: 'active' as const, endsAt: null },
        },
        { id: 3, status: 'closed' as const, endsAt: PAST },
      ];

      const result = await syncPollStatuses(prisma, polls, NOW);

      expect(updateMany).not.toHaveBeenCalled();
      expect(result).toBe(polls);
    });

    it('writes through a poll past its own end, and reflects it in memory', async () => {
      const polls = [
        { id: 1, status: 'active' as const, endsAt: PAST },
        { id: 2, status: 'active' as const, endsAt: FUTURE },
      ];

      const result = await syncPollStatuses(prisma, polls, NOW);

      expect(updateMany).toHaveBeenCalledTimes(1);
      expect(updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1] }, status: { not: 'closed' } },
        data: { status: 'closed' },
      });
      expect(result).toEqual([
        { id: 1, status: 'closed', endsAt: PAST },
        { id: 2, status: 'active', endsAt: FUTURE },
      ]);
    });

    it("writes through a poll whose room's end has passed", async () => {
      const polls = [
        {
          id: 1,
          status: 'active' as const,
          endsAt: FUTURE,
          room: { status: 'active' as const, endsAt: PAST },
        },
      ];

      const result = await syncPollStatuses(prisma, polls, NOW);

      expect(updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1] }, status: { not: 'closed' } },
        data: { status: 'closed' },
      });
      expect(result[0].status).toBe('closed');
    });

    it('reflects — but does not write — a closure that only comes from a room closed by hand', async () => {
      const polls = [
        {
          id: 1,
          status: 'active' as const,
          endsAt: FUTURE,
          room: { status: 'closed' as const, endsAt: FUTURE },
        },
      ];

      const result = await syncPollStatuses(prisma, polls, NOW);

      expect(updateMany).not.toHaveBeenCalled();
      expect(result[0].status).toBe('closed');
    });

    it('queries only the terminal rows while reflecting every over poll', async () => {
      const polls = [
        { id: 1, status: 'active' as const, endsAt: PAST },
        {
          id: 2,
          status: 'active' as const,
          endsAt: FUTURE,
          room: { status: 'closed' as const, endsAt: FUTURE },
        },
        { id: 3, status: 'active' as const, endsAt: FUTURE },
      ];

      const result = await syncPollStatuses(prisma, polls, NOW);

      expect(updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1] }, status: { not: 'closed' } },
        data: { status: 'closed' },
      });
      expect(result.map((poll) => poll.status)).toEqual([
        'closed',
        'closed',
        'active',
      ]);
    });
  });

  describe('closeExpiredPolls', () => {
    const updateMany = jest.fn();
    const prisma = { poll: { updateMany } } as unknown as PrismaService;

    beforeEach(() => jest.clearAllMocks());

    it("closes every non-deleted poll past its own or its room's end and returns the count", async () => {
      updateMany.mockResolvedValue({ count: 4 });

      await expect(closeExpiredPolls(prisma, NOW)).resolves.toBe(4);
      expect(updateMany).toHaveBeenCalledWith({
        where: {
          status: { not: 'closed' },
          deletedAt: null,
          OR: [
            { endsAt: { lte: NOW } },
            { room: { is: { endsAt: { not: null, lte: NOW } } } },
          ],
        },
        data: { status: 'closed' },
      });
    });
  });
});
