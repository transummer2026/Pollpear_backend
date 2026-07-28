export interface AppRoleLogin {
  token: string;
  ttl: number;
  policies: string[];
}

interface AppRoleLoginResponse {
  auth: {
    client_token: string;
    lease_duration: number;
    token_policies: string[];
  };
}

interface KvResponse<T> {
  data: { data: T };
}

const REQUEST_TIMEOUT_MS = 5000;
const MAX_ATTEMPTS = 3;

class VaultRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export class VaultClient {
  constructor(private readonly addr: string) {}

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(`${this.addr}${path}`, {
          ...init,
          signal: controller.signal,
        });
        if (res.ok) return (await res.json()) as T;
        throw new VaultRequestError(
          `${path} failed (HTTP ${res.status})`,
          res.status >= 500,
        );
      } catch (error) {
        if (error instanceof VaultRequestError && !error.retryable) throw error;
        lastError = error;
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
        }
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`${path} request failed`);
  }

  async appRoleLogin(roleId: string, secretId: string): Promise<AppRoleLogin> {
    const { auth } = await this.request<AppRoleLoginResponse>(
      '/v1/auth/approle/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: roleId, secret_id: secretId }),
      },
    );
    return {
      token: auth.client_token,
      ttl: auth.lease_duration,
      policies: auth.token_policies,
    };
  }

  async readKv<T = Record<string, string>>(
    token: string,
    path: string,
  ): Promise<T> {
    const body = await this.request<KvResponse<T>>(`/v1/secret/data/${path}`, {
      headers: { 'X-Vault-Token': token },
    });
    return body.data.data;
  }
}
