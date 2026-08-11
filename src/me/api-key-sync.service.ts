import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { fingerprint } from './api-key';

@Injectable()
export class ApiKeySyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ApiKeySyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async onApplicationBootstrap() {
    try {
      const restored = await this.restoreApiKeys();
      this.logger.log(`restored ${restored} api key(s) in redis`);
    } catch (error) {
      this.logger.error(`could not restore api keys: ${String(error)}`);
    }
  }

  private async restoreApiKeys(): Promise<number> {
    const apiKeys = await this.selectRestorableKeys();
    let restored = 0;

    for (const apiKey of apiKeys) {
      const ttl = this.remainingSeconds(apiKey.expiresAt);
      if (ttl <= 0) {
        this.logger.warn(
          `skipped ${fingerprint(apiKey.keyHash)} of user ${apiKey.ownerId}: ` +
            `expired at ${apiKey.expiresAt.toISOString()}`,
        );
        continue;
      }
      await this.redis.setApiKey(apiKey.keyHash, apiKey.ownerId, ttl);
      this.logger.debug(
        `restored ${fingerprint(apiKey.keyHash)} for user ${apiKey.ownerId}, ` +
          `ttl ${ttl}s (expires ${apiKey.expiresAt.toISOString()})`,
      );
      restored += 1;
    }

    return restored;
  }

  private remainingSeconds(expiresAt: Date): number {
    const remaining = expiresAt.getTime() - Date.now();
    return Math.floor(remaining / 1000);
  }

  private async selectRestorableKeys() {
    return await this.prisma.apiKey.findMany({
      where: {
        revoked: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        keyHash: true,
        ownerId: true,
        expiresAt: true,
      },
    });
  }
}
