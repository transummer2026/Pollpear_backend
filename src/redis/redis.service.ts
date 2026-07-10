import { InjectRedis } from '@nestjs-modules/ioredis';
import { Injectable } from '@nestjs/common';
import { UUID } from 'crypto';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async setRedisCache(sessionId: UUID, userId: number) {
    const key = `session:${sessionId}`;
    await this.redis.hset(key, { userId, sessionId });
    await this.redis.expire(key, 60 * 60 * 24); // e.g. 24h, tune to your needs
  }
}
