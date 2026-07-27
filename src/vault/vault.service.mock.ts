import { VaultService } from './vault.service';

export const vaultServiceMock = {
  provide: VaultService,
  useValue: {
    session: { pepper: 'test-pepper' },
    oauth: {
      google: {
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        redirect_uri: 'http://localhost:3000/auth/oauth/google/callback',
      },
      '42': {
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        redirect_uri: 'http://localhost:3000/auth/oauth/school42/callback',
      },
    },
  },
};
