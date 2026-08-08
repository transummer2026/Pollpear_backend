import {
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import { UsersService } from 'src/users/users.service';
import { AuthGuard } from './auth.guard';

function httpContext(headers: Record<string, string>): ExecutionContext {
  const request = { headers };
  return {
    getType: () => 'http',
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function wsContext(data: Record<string, unknown>): ExecutionContext {
  return {
    getType: () => 'ws',
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToWs: () => ({
      getClient: () => ({ id: 'socket-1', data }),
      getData: () => ({ some: 'payload' }),
    }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  const findByUserId = jest.fn();
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  } as unknown as Reflector;
  const guard = new AuthGuard(reflector, {
    findByUserId,
  } as unknown as UsersService);

  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  beforeEach(() => {
    jest.clearAllMocks();
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
  });

  it('lets a public handler through without any lookup', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);

    await expect(guard.canActivate(wsContext({}))).resolves.toBe(true);
    expect(findByUserId).not.toHaveBeenCalled();
  });

  describe('http', () => {
    it('accepts a known user and attaches it to the request', async () => {
      const user = { id: 42 };
      findByUserId.mockResolvedValue(user);
      const context = httpContext({ 'x-user-id': '42' });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(context.switchToHttp().getRequest()).toMatchObject({
        userId: 42,
        user,
      });
    });

    it('throws an http exception when the header is missing', async () => {
      await expect(guard.canActivate(httpContext({}))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws an http exception for an unknown user', async () => {
      findByUserId.mockResolvedValue(null);

      await expect(
        guard.canActivate(httpContext({ 'x-user-id': '42' })),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('ws', () => {
    it('accepts a socket bound to a known user', async () => {
      findByUserId.mockResolvedValue({ id: 42 });

      await expect(guard.canActivate(wsContext({ userId: 42 }))).resolves.toBe(
        true,
      );
      expect(findByUserId).toHaveBeenCalledWith(42);
    });

    it('throws a ws exception for an unbound socket, without any lookup', async () => {
      await expect(guard.canActivate(wsContext({}))).rejects.toThrow(
        WsException,
      );
      expect(findByUserId).not.toHaveBeenCalled();
    });

    it('throws a ws exception when the user no longer exists', async () => {
      findByUserId.mockResolvedValue(null);

      await expect(
        guard.canActivate(wsContext({ userId: 42 })),
      ).rejects.toThrow(WsException);
    });
  });
});
