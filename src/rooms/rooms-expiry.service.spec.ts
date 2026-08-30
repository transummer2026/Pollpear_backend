import { PrismaService } from 'src/prisma/prisma.service';
import { RoomsExpiryService } from './rooms-expiry.service';

describe('RoomsExpiryService', () => {
  const updateMany = jest.fn();
  const prisma = { room: { updateMany } } as unknown as PrismaService;
  const service = new RoomsExpiryService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('sweeps expired rooms on the scheduled run', async () => {
    updateMany.mockResolvedValue({ count: 2 });

    await service.closeExpiredRooms();

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        status: 'active',
        deletedAt: null,
        endsAt: { not: null, lte: expect.any(Date) as Date },
      },
      data: { status: 'closed' },
    });
  });

  it('runs without error when nothing is expired', async () => {
    updateMany.mockResolvedValue({ count: 0 });

    await expect(service.closeExpiredRooms()).resolves.toBeUndefined();
  });
});
