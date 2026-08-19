import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { UserId } from './user-id.decorator';

/**
 * createParamDecorator hides the factory behind route-args metadata;
 * this is the documented way to get it back for a unit test.
 */
function userIdFactory(): (data: unknown, ctx: ExecutionContext) => number {
  class TestHost {
    handler(@UserId() _userId: number) {
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

function httpContext(request: { userId?: number }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('UserId', () => {
  const factory = userIdFactory();

  it('injects the userId attached to the request', () => {
    expect(factory(undefined, httpContext({ userId: 42 }))).toBe(42);
  });

  it('yields undefined when no guard set a userId', () => {
    expect(factory(undefined, httpContext({}))).toBeUndefined();
  });
});
