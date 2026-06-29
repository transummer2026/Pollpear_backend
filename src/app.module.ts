import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { BansModule } from './bans/bans.module';
import { FeedModule } from './feed/feed.module';
import { UsersModule } from './users/users.module';
import { RoomsModule } from './rooms/rooms.module';
import { MessagesModule } from './messages/messages.module';
import { HashtagsModule } from './hashtags/hashtags.module';
import { ReportsModule } from './reports/reports.module';
import { PollsModule } from './polls/polls.module';
import { MeModule } from './me/me.module';
import { ContactModule } from './contact/contact.module';
import { ApiModule } from './api/api.module';
import { SearchModule } from './search/search.module';
import { MetricsModule } from './metrics/metrics.module';
import { SecretsModule } from './secrets/secrets.module';
import { CatsModule } from './cats/cats.module';
import { CatsController } from './cats/cats.controller';

/**
 * module is used by Nest to organise the application structure
 * efficiently. This is the root module, which serves as the
 * starting point for nest to build the application graph where relationships
 * and dependencies are mapped.
 * In our application, we have multiple modules each encapsulating
 * their own set of related capabilities.
 * imports is the list of imported modules that export the providers
 * required in the app.module.ts
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AdminModule,
    AuthModule,
    UsersModule,
    RoomsModule,
    MessagesModule,
    HashtagsModule,
    BansModule,
    ReportsModule,
    PollsModule,
    SecretsModule,
    FeedModule,
    MeModule,
    AiModule,
    ContactModule,
    ApiModule,
    SearchModule,
    MetricsModule,
    CatsModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes(CatsController);
  }
}
