import { Logger } from '@nestjs/common';
import { VaultClient } from './vault.client';

function jsonResponse(payload: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(payload) };
}

function errorResponse(status: number) {
  return { ok: false, status };
}

describe('VaultClient', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn();
  const client = new VaultClient('http://vault:8200');

  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock;
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('appRoleLogin', () => {
    it('posts the credentials and maps the vault auth payload', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          auth: {
            client_token: 'tok',
            lease_duration: 3600,
            token_policies: ['pollpear'],
          },
        }),
      );

      const login = await client.appRoleLogin('role-1', 'secret-1');

      expect(login).toEqual({
        token: 'tok',
        ttl: 3600,
        policies: ['pollpear'],
      });
      expect(fetchMock).toHaveBeenCalledWith(
        'http://vault:8200/v1/auth/approle/login',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role_id: 'role-1', secret_id: 'secret-1' }),
        }),
      );
    });
  });

  describe('readKv', () => {
    it('sends the vault token header and unwraps data.data', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ data: { data: { pepper: 'spicy' } } }),
      );

      const secrets = await client.readKv('tok', 'pollpear/session');

      expect(secrets).toEqual({ pepper: 'spicy' });
      expect(fetchMock).toHaveBeenCalledWith(
        'http://vault:8200/v1/secret/data/pollpear/session',
        expect.objectContaining({ headers: { 'X-Vault-Token': 'tok' } }),
      );
    });
  });

  describe('retry policy', () => {
    it('gives up on a 4xx without any retry', async () => {
      fetchMock.mockResolvedValue(errorResponse(403));

      await expect(client.readKv('tok', 'pollpear/db')).rejects.toThrow(
        '/v1/secret/data/pollpear/db failed (HTTP 403)',
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retries a 5xx three times then fails with the last error', async () => {
      fetchMock.mockResolvedValue(errorResponse(503));

      await expect(client.appRoleLogin('role-1', 'secret-1')).rejects.toThrow(
        '/v1/auth/approle/login failed (HTTP 503)',
      );
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('recovers when a retry succeeds', async () => {
      fetchMock
        .mockResolvedValueOnce(errorResponse(500))
        .mockResolvedValue(jsonResponse({ data: { data: { ok: 'yes' } } }));

      await expect(client.readKv('tok', 'pollpear/app')).resolves.toEqual({
        ok: 'yes',
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
