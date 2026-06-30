import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { FeedService } from './feed.service';
import { FeedController } from './feed.controller';
import { LoggerMiddleware } from 'src/common/middleware/logger.middleware';

@Module({
  controllers: [FeedController],
  providers: [FeedService],
})
export class MeModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('feed');
  }
}