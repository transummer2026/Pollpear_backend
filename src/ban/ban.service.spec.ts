import { PrismaService } from 'src/prisma/prisma.service';
import { BanService } from './ban.service';

type FindFirstArgs = { where: Record<string, unknown> };

describe('BanService', () => {
  let service: BanService;
  let prisma: {
    ban: { findFirst: jest.Mock<Promise<unknown>, [FindFirstArgs]> };
  };

  beforeEach(() => {
    prisma = {
      ban: { findFirst: jest.fn<Promise<unknown>, [FindFirstArgs]>() },
    };
    service = new BanService(prisma as unknown as PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByBanStatus', () => {
    it('matches only bans that have not ended yet', async () => {
      const ban = { id: 1 };
      prisma.ban.findFirst.mockResolvedValue(ban);

      await expect(service.findByBanStatus(42)).resolves.toBe(ban);

      expect(prisma.ban.findFirst).toHaveBeenCalledWith({
        where: { userId: 42, endedAt: { gt: expect.any(Date) as Date } },
      });
    });
  });
});
