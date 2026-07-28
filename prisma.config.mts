import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';
import { appRoleLoginFromEnv } from './src/vault/vault.bootstrap.js';

dotenv.config({ path: '../.env' });

async function resolveDatabaseUrl(): Promise<string> {
  if (
    !process.env.VAULT_ADDR ||
    !process.env.ROLE_ID ||
    !process.env.SECRET_ID
  ) {
    return 'postgresql://placeholder';
  }
  const { vault, token } = await appRoleLoginFromEnv();
  const db = await vault.readKv<{ database_url: string }>(token, 'pollpear/db');
  return db.database_url;
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: await resolveDatabaseUrl(),
  },
});
