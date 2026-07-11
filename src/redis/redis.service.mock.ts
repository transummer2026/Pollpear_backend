import { RedisService } from './redis.service';

export const redisServiceMock = {
  provide: RedisService,
  useValue: {},
};
