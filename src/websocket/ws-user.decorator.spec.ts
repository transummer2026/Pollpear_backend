import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { WsException } from '@nestjs/websockets';
import { wsExecutionContextMock } from './ws-execution-context.mock';
import { WsUser } from './ws-user.decorator';
import type { User } from 'src/generated/prisma/client';

/**
 * createParamDecorator hides the factory behind route-args metadata;
 * this is the documented way to get it back for a unit test.
 */
function wsUserFactory(): (data: unknown, ctx: ExecutionContext) => User {
  class TestHost {
    handler(@WsUser() _user: User) {
      void _user;
    }
  }
  const metadata = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    TestHost,
    'handler',
  ) as Record<
    string,
    { factory: (data: unknown, ctx: ExecutionContext) => User }
  >;
  return metadata[Object.keys(metadata)[0]].factory;
}

describe('WsUser', () => {
  const factory = wsUserFactory();
  const user = { id: 42, username: 'jojo0' } as User;

  it('injects the user bound to the socket', () => {
    expect(factory(undefined, wsExecutionContextMock({ user }))).toBe(user);
  });

  it('throws a WsException when the socket was never bound', () => {
    expect(() => factory(undefined, wsExecutionContextMock({}))).toThrow(
      WsException,
    );
  });
});
