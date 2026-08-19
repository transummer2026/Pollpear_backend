import { PrismaService } from 'src/prisma/prisma.service';
import { PresenceService } from './presence.service';

describe('PresenceService', () => {
  const update = jest.fn();
  const updateMany = jest.fn();
  const prisma = { user: { update, updateMany } } as unknown as PrismaService;
  const service = new PresenceService(prisma);

  beforeEach(() => jest.clearAllMocks());

  afterEach(() => jest.useRealTimers());

  it('marks the user online', async () => {
    await service.setOnline(7);

    expect(update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { isOnline: true },
    });
  });

  it('marks the user offline and stamps the last seen date', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-19T12:00:00Z'));

    await service.setOffline(7);

    expect(update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { isOnline: false, lastSeenAt: new Date('2026-08-19T12:00:00Z') },
    });
  });

  it('resets every user still flagged online and reports how many', async () => {
    updateMany.mockResolvedValue({ count: 3 });

    const count = await service.resetAll();

    expect(updateMany).toHaveBeenCalledWith({
      where: { isOnline: true },
      data: { isOnline: false },
    });
    expect(count).toBe(3);
  });
});
