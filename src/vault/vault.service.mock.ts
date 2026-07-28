import { VaultService } from './vault.service';

export const vaultServiceMock = {
  provide: VaultService,
  useValue: {
    session: { pepper: 'test-pepper' },
  },
};
