import { ArgumentsHost, Logger } from '@nestjs/common';
import { VaultService } from 'src/vault/vault.service';
import { OauthExceptionFilter } from './oauth-exception.filter';

function setup(frontendUrl: string) {
  const redirect = jest.fn();
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ redirect }) }),
  } as unknown as ArgumentsHost;
  const vault = {
    app: { frontend_url: frontendUrl },
  } as unknown as VaultService;

  return { filter: new OauthExceptionFilter(vault), redirect, host };
}

describe('OauthExceptionFilter', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  beforeEach(() => jest.clearAllMocks());

  it('redirects to the frontend with an oauth_failed flag', () => {
    const { filter, redirect, host } = setup('https://front.pollpear.dev');

    filter.catch(new Error('provider timeout'), host);

    expect(redirect).toHaveBeenCalledWith(
      'https://front.pollpear.dev/?error=oauth_failed',
    );
  });

  it('preserves an existing path on the frontend url', () => {
    const { filter, redirect, host } = setup('https://front.pollpear.dev/app');

    filter.catch(new Error('provider timeout'), host);

    expect(redirect).toHaveBeenCalledWith(
      'https://front.pollpear.dev/app?error=oauth_failed',
    );
  });

  it('preserves an existing query on the frontend url', () => {
    const { filter, redirect, host } = setup(
      'https://front.pollpear.dev/?lang=fr',
    );

    filter.catch(new Error('provider timeout'), host);

    expect(redirect).toHaveBeenCalledWith(
      'https://front.pollpear.dev/?lang=fr&error=oauth_failed',
    );
  });

  it('handles a non-error throw the same way', () => {
    const { filter, redirect, host } = setup('https://front.pollpear.dev');

    filter.catch('oauth blew up', host);

    expect(redirect).toHaveBeenCalledWith(
      'https://front.pollpear.dev/?error=oauth_failed',
    );
  });
});
