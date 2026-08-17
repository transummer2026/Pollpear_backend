import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { VISIBLE_BY_BAN } from 'src/common/decorators/ban.decorator';
import { IS_PUBLIC_KEY } from 'src/common/decorators/public.decorator';
import { BanGuard } from './userban.guard';
import { UsersService } from './users.service';

function httpContext(userId?: number): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ userId }) }),
  } as unknown as ExecutionContext;
}

describe('BanGuard', () => {
  const findByBanStatus = jest.fn();
  const getAllAndOverride = jest.fn();
  const reflector = { getAllAndOverride } as unknown as Reflector;
  const guard = new BanGuard(
    { findByBanStatus } as unknown as UsersService,
    reflector,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    getAllAndOverride.mockReturnValue(false);
  });

  it('lets a public handler through without any ban lookup', async () => {
    getAllAndOverride.mockImplementation((key) => key === IS_PUBLIC_KEY);

    await expect(guard.canActivate(httpContext())).resolves.toBe(true);
    expect(findByBanStatus).not.toHaveBeenCalled();
  });

  it('lets a handler marked visible-by-ban through without any lookup', async () => {
    getAllAndOverride.mockImplementation((key) => key === VISIBLE_BY_BAN);

    await expect(guard.canActivate(httpContext(42))).resolves.toBe(true);
    expect(findByBanStatus).not.toHaveBeenCalled();
  });

  it('rejects a request that carries no user id', async () => {
    const context = httpContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow('No user id.');
    expect(findByBanStatus).not.toHaveBeenCalled();
  });

  it('rejects a user with an active ban', async () => {
    findByBanStatus.mockResolvedValue({ id: 7 });
    const context = httpContext(42);

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow('User is banned.');
  });

  it('lets an unbanned user through', async () => {
    findByBanStatus.mockResolvedValue(null);

    await expect(guard.canActivate(httpContext(42))).resolves.toBe(true);
    expect(findByBanStatus).toHaveBeenCalledWith(42);
  });
});
