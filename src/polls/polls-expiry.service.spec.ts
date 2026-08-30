import { PrismaService } from 'src/prisma/prisma.service';
import { PollsExpiryService } from './polls-expiry.service';

describe('PollsExpiryService', () => {
  const updateMany = jest.fn();
  const prisma = { poll: { updateMany } } as unknown as PrismaService;
  const service = new PollsExpiryService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('sweeps expired polls on the scheduled run', async () => {
    updateMany.mockResolvedValue({ count: 3 });

    await service.closeExpiredPolls();

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        status: { not: 'closed' },
        deletedAt: null,
        OR: [
          { endsAt: { lte: expect.any(Date) as Date } },
          {
            room: {
              is: { endsAt: { not: null, lte: expect.any(Date) as Date } },
            },
          },
        ],
      },
      data: { status: 'closed' },
    });
  });

  it('runs without error when nothing is expired', async () => {
    updateMany.mockResolvedValue({ count: 0 });

    await expect(service.closeExpiredPolls()).resolves.toBeUndefined();
  });
});
