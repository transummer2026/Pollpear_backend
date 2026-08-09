import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { WsException } from '@nestjs/websockets';
import { wsExecutionContextMock } from './ws-execution-context.mock';
import { WsUserId } from './ws-user-id.decorator';

/**
 * createParamDecorator hides the factory behind route-args metadata;
 * this is the documented way to get it back for a unit test.
 */
function wsUserIdFactory(): (data: unknown, ctx: ExecutionContext) => number {
  class TestHost {
    handler(@WsUserId() _userId: number) {
      void _userId;
    }
  }
  const metadata = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    TestHost,
    'handler',
  ) as Record<
    string,
    { factory: (data: unknown, ctx: ExecutionContext) => number }
  >;
  return metadata[Object.keys(metadata)[0]].factory;
}

describe('WsUserId', () => {
  const factory = wsUserIdFactory();

  it('injects the user id bound to the socket', () => {
    expect(factory(undefined, wsExecutionContextMock({ userId: 42 }))).toBe(42);
  });

  it('throws a WsException when the socket was never bound', () => {
    expect(() => factory(undefined, wsExecutionContextMock({}))).toThrow(
      WsException,
    );
  });
});
