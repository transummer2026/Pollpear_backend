import { appRoleLoginFromEnv } from './vault.bootstrap';
import { VaultClient } from './vault.client';

jest.mock('./vault.client', () => ({
  VaultClient: jest.fn(),
}));

describe('appRoleLoginFromEnv', () => {
  const appRoleLogin = jest.fn();
  const vaultInstance = { appRoleLogin } as unknown as VaultClient;
  const MockedVaultClient = jest.mocked(VaultClient);
  MockedVaultClient.mockImplementation(() => vaultInstance);

  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    savedEnv = process.env;
    process.env = { ...savedEnv };
    delete process.env.VAULT_ADDR;
    delete process.env.ROLE_ID;
    delete process.env.SECRET_ID;
  });
  afterEach(() => {
    process.env = savedEnv;
  });

  it('logs in with the env credentials and returns the client alongside the login', async () => {
    process.env.VAULT_ADDR = 'http://vault:8200';
    process.env.ROLE_ID = 'role-1';
    process.env.SECRET_ID = 'secret-1';
    appRoleLogin.mockResolvedValue({
      token: 'tok',
      ttl: 3600,
      policies: ['pollpear'],
    });

    const result = await appRoleLoginFromEnv();

    expect(MockedVaultClient).toHaveBeenCalledWith('http://vault:8200');
    expect(appRoleLogin).toHaveBeenCalledWith('role-1', 'secret-1');
    expect(result).toEqual({
      vault: vaultInstance,
      token: 'tok',
      ttl: 3600,
      policies: ['pollpear'],
    });
  });

  it('lists every missing variable when none are set', async () => {
    await expect(appRoleLoginFromEnv()).rejects.toThrow(
      new Error(
        'Missing Vault bootstrap creds: VAULT_ADDR, ROLE_ID, SECRET_ID',
      ),
    );
    expect(MockedVaultClient).not.toHaveBeenCalled();
  });

  it.each([
    ['VAULT_ADDR', { ROLE_ID: 'role-1', SECRET_ID: 'secret-1' }],
    ['ROLE_ID', { VAULT_ADDR: 'http://vault:8200', SECRET_ID: 'secret-1' }],
    ['SECRET_ID', { VAULT_ADDR: 'http://vault:8200', ROLE_ID: 'role-1' }],
  ])('names only %s when it is the one missing', async (missing, present) => {
    Object.assign(process.env, present);

    await expect(appRoleLoginFromEnv()).rejects.toThrow(
      new Error(`Missing Vault bootstrap creds: ${missing}`),
    );
    expect(appRoleLogin).not.toHaveBeenCalled();
  });

  it('treats an empty string as missing', async () => {
    process.env.VAULT_ADDR = '';
    process.env.ROLE_ID = 'role-1';
    process.env.SECRET_ID = 'secret-1';

    await expect(appRoleLoginFromEnv()).rejects.toThrow(
      new Error('Missing Vault bootstrap creds: VAULT_ADDR'),
    );
  });
});
