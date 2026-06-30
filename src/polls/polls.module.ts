import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { PollsService } from './polls.service';
import { PollsController } from './polls.controller';
import { LoggerMiddleware } from 'src/common/middleware/logger.middleware';

@Module({
  controllers: [PollsController],
  providers: [PollsService],
})
export class PollsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes(PollsController);
  }
