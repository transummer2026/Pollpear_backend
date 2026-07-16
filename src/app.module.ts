import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { FeedModule } from './feed/feed.module';
import { UsersModule } from './users/users.module';
import { RoomsModule } from './rooms/rooms.module';
import { PollsModule } from './polls/polls.module';
import { MeModule } from './me/me.module';
import { ContactModule } from './contact/contact.module';
import { ApiModule } from './api/api.module';
import { SearchModule } from './search/search.module';
import { SecretsModule } from './secrets/secrets.module';
import { ApiKeysModule } from './api/v1/keys/keys.module';
import { ApiRegisterModule } from './api/v1/register/register.module';
import { ApiUsersModule } from './api/v1/users/users.module';
import { ApiPollsModule } from './api/v1/polls/polls.module';
import { RedisModule as RedisModuleIo } from '@nestjs-modules/ioredis';
import { RedisModule } from './redis/redis.module';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from 'src/auth/auth.guard';
import { FileUploadModule } from './file-upload/file-upload.module';
import { HealthModule } from './health/health.module';

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
    HealthModule,
    PrismaModule,
    UsersModule,
    RoomsModule,
    PollsModule,
    SecretsModule,
    FeedModule,
    MeModule,
    AiModule,
    ContactModule,
    ApiModule,
    SearchModule,
    ApiKeysModule,
    ApiRegisterModule,
    ApiPollsModule,
    ApiUsersModule,
    RedisModule,
    RedisModuleIo.forRoot({
      type: 'single',
      url: process.env.REDIS_URL,
    }),
    FileUploadModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
