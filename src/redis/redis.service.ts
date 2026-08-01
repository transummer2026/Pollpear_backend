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
    const sessionKeys = sessionIds.map((id) => `session:${id}`);
    await this.redis.del(userKey, ...sessionKeys);
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
}
