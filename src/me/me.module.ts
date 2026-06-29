import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MeService } from './me.service';
import { MeController } from './me.controller';
import { LoggerMiddleware } from 'src/common/middleware/logger.middleware';

@Module({
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('me');
  }
}
