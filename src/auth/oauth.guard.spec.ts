import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { OauthGuard } from './oauth.guard';

/**
 * Only the unknown-provider branch is unit-testable: the nominal path
 * instantiates a PassportAuthGuard(provider) that needs a strategy
 * registered in the Nest container, which is e2e territory.
 */
function httpContext(params: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ params }) }),
  } as unknown as ExecutionContext;
}

describe('OauthGuard', () => {
  const guard = new OauthGuard();

  it('rejects a provider that has no wired strategy', async () => {
    const call = guard.canActivate(httpContext({ provider: 'facebook' }));

    await expect(call).rejects.toThrow(NotFoundException);
    await expect(call).rejects.toThrow('Unknown oauth provider: facebook');
  });

  it('rejects a request without any provider parameter', async () => {
    await expect(guard.canActivate(httpContext({}))).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects an empty provider parameter', async () => {
    await expect(
      guard.canActivate(httpContext({ provider: '' })),
    ).rejects.toThrow(NotFoundException);
  });

  it('unwraps an array parameter and rejects its unknown first entry', async () => {
    await expect(
      guard.canActivate(httpContext({ provider: ['facebook', 'google'] })),
    ).rejects.toThrow('Unknown oauth provider: facebook');
  });
});
