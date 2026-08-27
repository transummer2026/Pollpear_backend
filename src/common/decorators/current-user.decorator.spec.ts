import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import type { User } from 'src/generated/prisma/client';
import { CurrentUser } from './current-user.decorator';

/**
 * createParamDecorator hides the factory behind route-args metadata;
 * this is the documented way to get it back for a unit test.
 */
function currentUserFactory(): (data: unknown, ctx: ExecutionContext) => User {
  class TestHost {
    handler(@CurrentUser() _user: User) {
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

function httpContext(request: { user?: User }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('CurrentUser', () => {
  const factory = currentUserFactory();

  it('injects the User attached to the request by AuthGuard', () => {
    const user = { id: 42, role: 'user' } as User;

    expect(factory(undefined, httpContext({ user }))).toBe(user);
  });

  it('yields undefined when no guard set a user', () => {
    expect(factory(undefined, httpContext({}))).toBeUndefined();
  });
});
