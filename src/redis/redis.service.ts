import { InjectRedis } from '@nestjs-modules/ioredis';
import { Injectable } from '@nestjs/common';
import { UUID } from 'crypto';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async setRedisCache(sessionId: UUID, userId: number) {
    const TTL = 60 * 30;

    const sessionKey = `session:${sessionId}`;
    await this.redis.hset(sessionKey, { userId });
    await this.redis.expire(sessionKey, TTL);

    const userKey = `user_sessions:${userId}`;
    await this.redis.hset(userKey, { [sessionId]: new Date().toISOString() });
    await this.redis.hexpire(userKey, TTL, 'FIELDS', 1, sessionId);
  }

  async deleteUserSessions(userId: number) {
    const userKey = `user_sessions:${userId}`;
    const sessionIds = await this.redis.hkeys(userKey);

    if (sessionIds.length > 0) {
      await this.redis.del(...sessionIds.map((id) => `session:${id}`));
    }
    await this.redis.del(userKey);
  }

  async setPasswordResetToken(token: UUID, userId: number) {
    const TTL = 60 * 60;

    const previousToken = await this.redis.get(`password_reset_user:${userId}`);
    if (previousToken) {
      await this.redis.del(`password_reset:${previousToken}`);
    }

    await this.redis.set(`password_reset:${token}`, userId, 'EX', TTL);
    await this.redis.set(`password_reset_user:${userId}`, token, 'EX', TTL);
  }

  async getPasswordResetToken(token: string): Promise<number | null> {
    const userId = await this.redis.get(`password_reset:${token}`);
    return userId ? Number(userId) : null;
  }

  async deletePasswordResetToken(token: string, userId: number) {
    await this.redis.del(
      `password_reset:${token}`,
      `password_reset_user:${userId}`,
    );
  }

  async setEmailVerifyToken(token: UUID, userId: number) {
    const TTL = 60 * 60 * 24;

    const previousToken = await this.redis.get(`email_verify_user:${userId}`);
    if (previousToken) {
      await this.redis.del(`email_verify:${previousToken}`);
    }

    await this.redis.set(`email_verify:${token}`, userId, 'EX', TTL);
    await this.redis.set(`email_verify_user:${userId}`, token, 'EX', TTL);
  }

  async getEmailVerifyToken(token: string): Promise<number | null> {
    const userId = await this.redis.get(`email_verify:${token}`);
    return userId ? Number(userId) : null;
  }

  async deleteEmailVerifyToken(token: string, userId: number) {
    await this.redis.del(
      `email_verify:${token}`,
      `email_verify_user:${userId}`,
    );
  }

  async setOauthPendingProfile(token: UUID, profile: string) {
    const TTL = 60 * 15;

    await this.redis.set(`oauth_pending:${token}`, profile, 'EX', TTL);
  }

  async getOauthPendingProfile(token: string): Promise<string | null> {
    return this.redis.get(`oauth_pending:${token}`);
  }

  async deleteOauthPendingProfile(token: string) {
    await this.redis.del(`oauth_pending:${token}`);
  }

  /**
   * Stores an API key in Redis with a TTL.
   * The key is stored as `apikey:{keyHash}` and the value is the userId of the owner.
   * @param keyHash hash of the plaintext key
   * @param userId owner the key acts on behalf of
   * @param ttl seconds left before the key expires
   */
  async setApiKey(keyHash: string, userId: number, ttl: number) {
    await this.redis.set(`apikey:${keyHash}`, userId, 'EX', ttl);
  }

  /**
   * revokes an API key from Redis, effectively invalidating it.
   * @param keyHash  hashed string
   */
  async deleteApiKey(keyHash: string) {
    if (keyHash.length === 0) {
      return;
    }
    await this.redis.del(`apikey:${keyHash}`);
  }

  async deleteApiKeys(keyHashes: string[]) {
    if (keyHashes.length === 0) {
      return;
    }
    await this.redis.del(...keyHashes.map((keyHash) => `apikey:${keyHash}`));
  }
}
