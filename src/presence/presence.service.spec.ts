import { UsersService } from 'src/users/users.service';
import { PresenceService } from './presence.service';

describe('PresenceService', () => {
  const setOnline = jest.fn();
  const setOffline = jest.fn();
  const resetOnlineStatus = jest.fn();
  const users = {
    setOnline,
    setOffline,
    resetOnlineStatus,
  } as unknown as UsersService;
  const service = new PresenceService(users);

  beforeEach(() => jest.clearAllMocks());

  it('marks the user online', async () => {
    await service.setOnline(7);

    expect(setOnline).toHaveBeenCalledWith(7);
  });

  it('marks the user offline', async () => {
    await service.setOffline(7);

    expect(setOffline).toHaveBeenCalledWith(7);
  });

  it('resets every user still flagged online and reports how many', async () => {
    resetOnlineStatus.mockResolvedValue(3);

    const count = await service.resetAll();

    expect(resetOnlineStatus).toHaveBeenCalled();
    expect(count).toBe(3);
  });
});
