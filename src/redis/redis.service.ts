import { InjectRedis } from '@nestjs-modules/ioredis';
import { Injectable } from '@nestjs/common';
import { UUID } from 'crypto';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async setRedisCache(sessionId: UUID, userId: number) {
    await this.redis.hset('sessionId', {
      userId,
      sessionId,
    });
  }
}
