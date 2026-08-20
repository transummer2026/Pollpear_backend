import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import {
  expiryFromTtl,
  fingerprint,
  generateApiKey,
  remainingSeconds,
} from './api-key.util';
import {
  ApiKeySchema,
  type ApiKeyCreatedDTO,
  type ApiKeyDTO,
} from 'Pollpear_shared/src/schemas/api-key.schema';

const DEFAULT_APP_NAME = 'default';
const API_KEY_LIFETIME_SECONDS = 365 * 24 * 60 * 60; // 1 year, in seconds

const PUBLIC_FIELDS = Object.fromEntries(
  Object.keys(ApiKeySchema.shape).map((field) => [field, true]),
) as Record<keyof ApiKeyDTO, true>;

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(userId: number, appName?: string): Promise<ApiKeyCreatedDTO> {
    const { key, keyHash } = generateApiKey();
    const expiresAt = expiryFromTtl(API_KEY_LIFETIME_SECONDS);

    const previous = await this.findActiveWithHash(userId);
    const [, apiKey] = await this.prisma.$transaction([
      this.prisma.apiKey.updateMany({
        where: this.activeWhere(userId),
        data: { revoked: true },
      }),
      this.insert(userId, keyHash, expiresAt, appName),
    ]);

    if (previous) {
      await this.redis.deleteApiKey(previous.keyHash);
    }
    await this.redis.setApiKey(keyHash, userId, API_KEY_LIFETIME_SECONDS);

    this.logger.log(
      `api key ${apiKey.id} issued to user ${userId} as "${apiKey.appName}" ` +
        `(${fingerprint(keyHash)}), expires ${expiresAt.toISOString()}`,
    );
    return { ...apiKey, key };
  }

  async findActive(userId: number): Promise<ApiKeyDTO | null> {
    return await this.prisma.apiKey.findFirst({
      where: this.activeWhere(userId),
      select: PUBLIC_FIELDS,
    });
  }

  async update(userId: number, appName: string): Promise<ApiKeyDTO> {
    const apiKey = await this.findActiveWithHash(userId);
    if (!apiKey) {
      this.logger.warn(`user ${userId} tried to rename a key it has not`);
      throw new NotFoundException('No active api key');
    }

    this.logger.log(
      `api key ${apiKey.id} of user ${userId} renamed "${appName}"`,
    );
    return await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { appName },
      select: PUBLIC_FIELDS,
    });
  }

  async revoke(userId: number) {
    const apiKey = await this.findActiveWithHash(userId);
    if (!apiKey) {
      return;
    }

    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { revoked: true },
    });
    await this.redis.deleteApiKey(apiKey.keyHash);
    this.logger.log(
      `api key ${apiKey.id} of user ${userId} revoked ` +
        `(${fingerprint(apiKey.keyHash)}), dropped from postgres and redis`,
    );
  }

  async revokeAll(userId: number) {
    const apiKeys = await this.prisma.apiKey.findMany({
      where: this.activeWhere(userId),
      select: { keyHash: true },
    });
    if (apiKeys.length === 0) {
      return;
    }

    await this.redis.deleteApiKeys(apiKeys.map((apiKey) => apiKey.keyHash));
    await this.prisma.apiKey.updateMany({
      where: this.activeWhere(userId),
      data: { revoked: true },
    });
    this.logger.warn(
      `api key ban on user ${userId}: ${apiKeys.length} key(s) revoked ` +
        `(${apiKeys.map((apiKey) => fingerprint(apiKey.keyHash)).join(', ')})`,
    );
  }

  async restoreAll(): Promise<number> {
    const apiKeys = await this.prisma.apiKey.findMany({
      where: this.activeWhere(),
      select: { keyHash: true, ownerId: true, expiredAt: true },
    });
    let restored = 0;

    for (const apiKey of apiKeys) {
      const ttl = remainingSeconds(apiKey.expiredAt);
      if (ttl <= 0) {
        continue;
      }
      await this.redis.setApiKey(apiKey.keyHash, apiKey.ownerId, ttl);
      this.logger.debug(
        `restored ${fingerprint(apiKey.keyHash)} for user ${apiKey.ownerId}, ` +
          `ttl ${ttl}s (expires ${apiKey.expiredAt.toISOString()})`,
      );
      restored += 1;
    }

    return restored;
  }

  private activeWhere(userId?: number) {
    return {
      ...(userId === undefined ? {} : { ownerId: userId }),
      revoked: false,
      expiredAt: {
        gt: new Date(),
      },
    };
  }

  private async findActiveWithHash(userId: number) {
    return await this.prisma.apiKey.findFirst({
      where: this.activeWhere(userId),
      select: { id: true, keyHash: true },
    });
  }

  private insert(
    userId: number,
    keyHash: string,
    expiresAt: Date,
    appName?: string,
  ) {
    return this.prisma.apiKey.create({
      data: {
        keyHash,
        ownerId: userId,
        expiredAt: expiresAt,
        appName: appName ?? DEFAULT_APP_NAME,
      },
      select: PUBLIC_FIELDS,
    });
  }
}
