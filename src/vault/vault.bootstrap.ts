import { VaultClient } from './vault.client';

export async function appRoleLoginFromEnv() {
  const addr = process.env.VAULT_ADDR;
  const roleId = process.env.ROLE_ID;
  const secretId = process.env.SECRET_ID;
  if (!addr || !roleId || !secretId) {
    const missing = [
      ['VAULT_ADDR', addr],
      ['ROLE_ID', roleId],
      ['SECRET_ID', secretId],
    ]
      .filter(([, value]) => !value)
      .map(([key]) => key);
    throw new Error(`Missing Vault bootstrap creds: ${missing.join(', ')}`);
  }

  const vault = new VaultClient(addr);
  const login = await vault.appRoleLogin(roleId, secretId);
  return { vault, ...login };
}
