import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import type { User } from 'src/generated/prisma/client';
import { RoomsService } from './rooms.service';

function searchRow(id: number, name = `room${id}`) {
  return { id, name };
}

const REQUESTER_ID = 1;
const requesterViewer = { id: REQUESTER_ID, role: 'user' } as User;

describe('RoomsService', () => {
  let service: RoomsService;
  let prisma: {
    room: {
      findMany: jest.Mock<Promise<unknown[]>, [Record<string, unknown>]>;
      count: jest.Mock<Promise<number>, [Record<string, unknown>]>;
    };
  };

  beforeEach(() => {
    prisma = {
      room: {
        findMany: jest.fn<Promise<unknown[]>, [Record<string, unknown>]>(),
        count: jest.fn<Promise<number>, [Record<string, unknown>]>(),
      },
    };
    service = new RoomsService(
      prisma as unknown as PrismaService,
      new CaslAbilityFactory(),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('search', () => {
    // Derived from the CASL room-read policy for a plain 'user' role: public
    // rooms, or rooms the requester is a member of.
    const baseWhere = {
      deletedAt: null,
      OR: [
        {
          deletedAt: null,
          roomMembers: {
            some: { userId: REQUESTER_ID, deletedAt: null },
          },
        },
        { deletedAt: null, visibility: 'public' },
      ],
    };
    const matchWhere = (q: string) => ({
      ...baseWhere,
      name: { contains: q, mode: 'insensitive' },
    });
    const startsWithWhere = (q: string) => ({
      ...baseWhere,
      name: { startsWith: q, mode: 'insensitive' },
    });

    it('ranks name prefixes first and fills the rest with contains matches', async () => {
      const prefixed = [searchRow(1, 'room-a'), searchRow(2, 'room-ab')];
      const contained = [searchRow(3, 'the-room-abc')];
      prisma.room.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
      prisma.room.findMany
        .mockResolvedValueOnce(prefixed)
        .mockResolvedValueOnce(contained);

      await expect(service.search('room', requesterViewer)).resolves.toEqual({
        items: [...prefixed, ...contained],
        total: 3,
      });

      expect(prisma.room.count).toHaveBeenNthCalledWith(1, {
        where: matchWhere('room'),
      });
      expect(prisma.room.count).toHaveBeenNthCalledWith(2, {
        where: startsWithWhere('room'),
      });
      expect(prisma.room.findMany).toHaveBeenNthCalledWith(1, {
        where: startsWithWhere('room'),
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        skip: 0,
        take: 5,
      });
      expect(prisma.room.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          ...matchWhere('room'),
          NOT: { name: { startsWith: 'room', mode: 'insensitive' } },
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        skip: 0,
        take: 3,
      });
    });

    it('orders alphabetically without the prefix phase when sortBy is alphabetical', async () => {
      const alphabetical = [searchRow(1, 'alpha'), searchRow(2, 'bravo')];
      prisma.room.count.mockResolvedValueOnce(2);
      prisma.room.findMany.mockResolvedValueOnce(alphabetical);

      await expect(
        service.search('a', requesterViewer, { sortBy: 'alphabetical' }),
      ).resolves.toEqual({ items: alphabetical, total: 2 });

      expect(prisma.room.count).toHaveBeenCalledTimes(1);
      expect(prisma.room.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.room.findMany).toHaveBeenCalledWith({
        where: matchWhere('a'),
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        skip: 0,
        take: 5,
      });
    });

    it('paginates with page/limit', async () => {
      const page2 = [searchRow(11)];
      prisma.room.count.mockResolvedValueOnce(11).mockResolvedValueOnce(11);
      prisma.room.findMany
        .mockResolvedValueOnce(page2)
        .mockResolvedValueOnce([]);

      await expect(
        service.search('room', requesterViewer, { page: 3, limit: 5 }),
      ).resolves.toEqual({ items: page2, total: 11 });

      expect(prisma.room.findMany).toHaveBeenCalledWith({
        where: startsWithWhere('room'),
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        skip: 10,
        take: 5,
      });
    });
  });
});
