import { Injectable, Logger } from '@nestjs/common';
import { VaultClient } from './vault.client';

export interface PollpearSecrets {
  db: { host: string; port: string; database: string; username: string; password: string; database_url: string };
  redis: { host: string; port: string; password: string };
  session: { ttl: string; cookie_secret: string };
  oauth: { google: OAuthCreds; '42': OAuthCreds };
}
interface OAuthCreds { client_id: string; client_secret: string; redirect_uri: string }

@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name);
  private secrets!: PollpearSecrets;

  async init(): Promise<void> {
    const addr = process.env.VAULT_ADDR;
    const roleId = process.env.ROLE_ID;
    const secretId = process.env.SECRET_ID;
    if (!addr || !roleId || !secretId) throw new Error();

    const vault = new VaultClient(addr);
    const { token, ttl, policies } = await vault.appRoleLogin(roleId, secretId);

    this.secrets = {
      db: await vault.readKv(token, 'pollpear/db'),
      redis: await vault.readKv(token, 'pollpear/redis'),
      session: await vault.readKv(token, 'pollpear/session'),
      oauth: {
        google: await vault.readKv(token, 'pollpear/oauth/google'),
        '42': await vault.readKv(token, 'pollpear/oauth/42'),
      },
    };
  }

  get db() { return this.secrets.db; }
  get redis() { return this.secrets.redis; }
  get session() { return this.secrets.session; }
  get oauth() { return this.secrets.oauth; }

}
