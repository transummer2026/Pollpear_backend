import { Injectable, Logger } from '@nestjs/common';
import { appRoleLoginFromEnv } from './vault.bootstrap';

export interface PollpearSecrets {
  db: {
    host: string;
    port: string;
    database: string;
    username: string;
    password: string;
    database_url: string;
  };
  redis: { host: string; port: string; password: string };
  session: { ttl: string; cookie_secret: string; pepper: string };
}

@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name);
  private secrets!: PollpearSecrets;

  async init(): Promise<void> {
    try {
      const { vault, token, ttl, policies } = await appRoleLoginFromEnv();
      this.secrets = {
        db: await vault.readKv(token, 'pollpear/db'),
        redis: await vault.readKv(token, 'pollpear/redis'),
        session: await vault.readKv(token, 'pollpear/session'),
      };
      this.logger.log(
        `Vault AppRole login ok (ttl=${ttl}s, policies=[${policies.join(', ')}])`,
      );
    } catch (error) {
      this.logger.error(
        `Vault init failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  get db() {
    return this.secrets.db;
  }
  get redis() {
    return this.secrets.redis;
  }
  get session() {
    return this.secrets.session;
  }
}
