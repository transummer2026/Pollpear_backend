import { Injectable, Logger } from '@nestjs/common';
import { appRoleLoginFromEnv } from './vault.bootstrap';

export interface DbSecrets {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  database_url: string;
}

export interface RedisSecrets {
  host: string;
  port: string;
  password: string;
}

export interface SessionSecrets {
  ttl: string;
  cookie_secret: string;
  pepper: string;
}

export interface MailSecrets {
  host: string;
  port: string;
  user: string;
  pass: string;
  from: string;
}

export interface S3Secrets {
  endpoint: string;
  region: string;
  bucket: string;
  access_key: string;
  secret_key: string;
}

export interface AppConfig {
  frontend_url: string;
}

export interface OauthCreds {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}

export interface OauthSecrets {
  google: OauthCreds;
  '42': OauthCreds;
}

export interface PollpearSecrets {
  db: DbSecrets;
  redis: RedisSecrets;
  session: SessionSecrets;
  mail: MailSecrets;
  s3: S3Secrets;
  app: AppConfig;
  oauth: OauthSecrets;
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
        mail: await vault.readKv(token, 'pollpear/mail'),
        s3: await vault.readKv(token, 'pollpear/s3'),
        app: await vault.readKv(token, 'pollpear/app'),
        oauth: {
          google: await vault.readKv(token, 'pollpear/oauth/google'),
          '42': await vault.readKv(token, 'pollpear/oauth/42'),
        },
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
  get mail() {
    return this.secrets.mail;
  }
  get s3() {
    return this.secrets.s3;
  }
  get app() {
    return this.secrets.app;
  }
  get oauth() {
    return this.secrets.oauth;
  }
}
