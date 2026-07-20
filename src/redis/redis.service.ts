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
}
