import { PrismaService } from 'src/prisma/prisma.service';
import {
  closeExpiredRooms,
  nextRoomStatus,
  roomHasEnded,
  syncRoomStatuses,
} from './room-status';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const PAST = new Date('2026-06-15T11:59:59.000Z');
const FUTURE = new Date('2026-06-15T12:00:01.000Z');

describe('room-status', () => {
  describe('roomHasEnded', () => {
    it('is false without an end date', () => {
      expect(roomHasEnded(null, NOW)).toBe(false);
      expect(roomHasEnded(undefined, NOW)).toBe(false);
    });

    it('is true once the end date is reached', () => {
      expect(roomHasEnded(PAST, NOW)).toBe(true);
      expect(roomHasEnded(NOW, NOW)).toBe(true);
      expect(roomHasEnded(FUTURE, NOW)).toBe(false);
    });
  });

  describe('nextRoomStatus', () => {
    it('keeps an active room active while its end is null or ahead', () => {
      expect(nextRoomStatus({ status: 'active', endsAt: null }, NOW)).toBe(
        'active',
      );
      expect(nextRoomStatus({ status: 'active', endsAt: FUTURE }, NOW)).toBe(
        'active',
      );
    });

    it('closes an active room whose end has passed', () => {
      expect(nextRoomStatus({ status: 'active', endsAt: PAST }, NOW)).toBe(
        'closed',
      );
    });

    it('never reopens a closed room', () => {
      expect(nextRoomStatus({ status: 'closed', endsAt: FUTURE }, NOW)).toBe(
        'closed',
      );
    });
  });

  describe('syncRoomStatuses', () => {
    const updateMany = jest.fn();
    const prisma = { room: { updateMany } } as unknown as PrismaService;

    beforeEach(() => jest.clearAllMocks());

    it('does not query when nothing has expired', async () => {
      const rooms = [
        { id: 1, status: 'active' as const, endsAt: null },
        { id: 2, status: 'active' as const, endsAt: FUTURE },
        { id: 3, status: 'closed' as const, endsAt: PAST },
      ];

      const result = await syncRoomStatuses(prisma, rooms, NOW);

      expect(updateMany).not.toHaveBeenCalled();
      expect(result).toEqual(rooms);
    });

    it('flips only the expired active rows, in one query, and reflects it in memory', async () => {
      const rooms = [
        { id: 1, status: 'active' as const, endsAt: PAST },
        { id: 2, status: 'active' as const, endsAt: FUTURE },
      ];

      const result = await syncRoomStatuses(prisma, rooms, NOW);

      expect(updateMany).toHaveBeenCalledTimes(1);
      expect(updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1] }, status: 'active' },
        data: { status: 'closed' },
      });
      expect(result).toEqual([
        { id: 1, status: 'closed', endsAt: PAST },
        { id: 2, status: 'active', endsAt: FUTURE },
      ]);
    });
  });

  describe('closeExpiredRooms', () => {
    const updateMany = jest.fn();
    const prisma = { room: { updateMany } } as unknown as PrismaService;

    beforeEach(() => jest.clearAllMocks());

    it('closes every active, non-deleted room past its end and returns the count', async () => {
      updateMany.mockResolvedValue({ count: 3 });

      await expect(closeExpiredRooms(prisma, NOW)).resolves.toBe(3);
      expect(updateMany).toHaveBeenCalledWith({
        where: {
          status: 'active',
          deletedAt: null,
          endsAt: { not: null, lte: NOW },
        },
        data: { status: 'closed' },
      });
    });
  });
});
