import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
import { ApiUsersModule } from './api/v1/users/users.module';
import { ApiPollsModule } from './api/v1/polls/polls.module';
import { RedisModule as RedisModuleIo } from '@nestjs-modules/ioredis';
import { RedisModule } from './redis/redis.module';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from 'src/auth/auth.guard';
import { FileUploadModule } from './file-upload/file-upload.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { VaultModule } from './vault/vault.module';
import { VaultService } from './vault/vault.service';
import { BanGuard } from './ban/ban.guard';
import { NotificationModule } from './notification/notification.module';
import { BanModule } from './ban/ban.module';
import { CaslModule } from './casl/casl.module';
import { AuthorizationGuard } from './casl/authorization.guard';
import { WebsocketModule } from './websocket/websocket.module';
import { PresenceModule } from './presence/presence.module';
import { MessagesModule } from './messages/messages.module';
import { InvitationModule } from './invitation/invitation.module';

/**
 * The root module: it wires every feature module together and registers the
 * three guards that apply to the whole application. Their order is the
 * registration order and it matters — AuthGuard identifies the caller,
 * BanGuard cuts a banned one off, and only then does AuthorizationGuard ask
 * the policy what the caller may do.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
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
    ApiPollsModule,
    ApiUsersModule,
    RedisModule,
    RedisModuleIo.forRootAsync({
      inject: [VaultService],
      useFactory: (vault: VaultService) => ({
        type: 'single',
        options: {
          host: vault.redis.host,
          port: Number(vault.redis.port),
          password: vault.redis.password,
        },
      }),
    }),
    FileUploadModule,
    MailModule,
    VaultModule,
    CaslModule,
    WebsocketModule,
    PresenceModule,
    MessagesModule,
    BanModule,
    NotificationModule,
    InvitationModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: BanGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthorizationGuard,
    },
  ],
})
export class AppModule {}
