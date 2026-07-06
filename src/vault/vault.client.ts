export interface AppRoleLogin { token: string; ttl: number; policies: string[]; }

export class VaultClient {
  constructor(private readonly addr: string) {}

  async appRoleLogin(roleId: string, secretId: string): Promise<AppRoleLogin> {
    const res = await fetch(`${this.addr}/v1/auth/approle/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id: roleId, secret_id: secretId }),
    });
    if (!res.ok) throw new Error(`AppRole login failed (HTTP ${res.status})`);
    const { auth } = await res.json();
    return { token: auth.client_token, ttl: auth.lease_duration, policies: auth.token_policies };
  }

  async readKv<T = Record<string, string>>(token: string, path: string): Promise<T> {
    const res = await fetch(`${this.addr}/v1/secret/data/${path}`, { headers: { 'X-Vault-Token': token } });
    if (!res.ok) throw new Error(`read ${path} failed (HTTP ${res.status})`);
    return (await res.json()).data.data as T;
  }
}
