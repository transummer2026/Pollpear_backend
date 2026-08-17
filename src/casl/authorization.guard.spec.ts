import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from 'src/generated/prisma/client';
import { AuthorizationGuard } from './authorization.guard';
import { AppAbility } from './casl-prisma';

function httpContext(user?: Partial<User>): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('AuthorizationGuard', () => {
  const ability = { marker: 'ability' } as unknown as AppAbility;
  const getAllAndOverride = jest.fn();
  const get = jest.fn();
  const reflector = { getAllAndOverride, get } as unknown as Reflector;
  const createForUser = jest.fn();
  const guard = new AuthorizationGuard(reflector, { createForUser });

  beforeEach(() => {
    jest.clearAllMocks();
    getAllAndOverride.mockReturnValue(false);
    get.mockReturnValue(undefined);
    createForUser.mockReturnValue(ability);
  });

  it('lets a public handler through without building any ability', () => {
    getAllAndOverride.mockReturnValue(true);

    expect(guard.canActivate(httpContext())).toBe(true);
    expect(createForUser).not.toHaveBeenCalled();
  });

  it('passes when no policy is attached to the handler', () => {
    expect(guard.canActivate(httpContext({ id: 1 }))).toBe(true);
  });

  it('builds the ability for the request user and hands it to the policy', () => {
    const user = { id: 42 };
    const policy = jest.fn().mockReturnValue(true);
    get.mockReturnValue([policy]);

    expect(guard.canActivate(httpContext(user))).toBe(true);
    expect(createForUser).toHaveBeenCalledWith(user);
    expect(policy).toHaveBeenCalledWith(ability);
  });

  it('rejects when a policy function returns false', () => {
    get.mockReturnValue([jest.fn().mockReturnValue(false)]);

    expect(guard.canActivate(httpContext({ id: 1 }))).toBe(false);
  });

  it('runs object handlers through their handle method', () => {
    const handle = jest.fn().mockReturnValue(true);
    get.mockReturnValue([{ handle }]);

    expect(guard.canActivate(httpContext({ id: 1 }))).toBe(true);
    expect(handle).toHaveBeenCalledWith(ability);
  });

  it('requires every policy to pass', () => {
    const allowing = jest.fn().mockReturnValue(true);
    const denying = jest.fn().mockReturnValue(false);
    get.mockReturnValue([allowing, denying]);

    expect(guard.canActivate(httpContext({ id: 1 }))).toBe(false);
    expect(allowing).toHaveBeenCalledWith(ability);
  });
});
