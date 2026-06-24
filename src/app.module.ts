import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
//import { CatsController } from './cats/cats.controller';
import { AuthController } from './auth/auth.controller';
import { LegalController } from './legal/legal.controller';
import { PrivacyController } from './privacy/privacy.controller';
import { ContactController } from './contact/contact.controller';
import { FeedController } from './feed/feed.controller';
import { MeController } from './me/me.controller';
import { UsersController } from './users/users.controller';
import { PollsController } from './polls/polls.controller';
import { RoomsController } from './rooms/rooms.controller';
import { UsersService } from './users/users.service';
import { SecretsService } from './secrets/secrets.service';
import { RoomsService } from './rooms/rooms.service';
import { ReportsService } from './reports/reports.service';
import { PrivacyService } from './privacy/privacy.service';
import { PollsService } from './polls/polls.service';
import { OptionsService } from './options/options.service';
import { MetricsService } from './metrics/metrics.service';
import { MessagesService } from './messages/messages.service';
import { MeService } from './me/me.service';
import { LegalService } from './legal/legal.service';
import { HashtagsService } from './hashtags/hashtags.service';
import { FeedService } from './feed/feed.service';
import { ContactService } from './contact/contact.service';
import { BansService } from './bans/bans.service';
import { AuthService } from './auth/auth.service';
import { AiService } from './ai/ai.service';
import { AdminService } from './admin/admin.service';
import { CatsModule } from './cats/cats.module';
import { SecretsController } from './secrets/secrets.controller';
import { AiController } from './ai/ai.controller';
import { MetricsController } from './metrics/metrics.controller';
import { AdminController } from './admin/admin.controller';
import { BansController } from './bans/bans.controller';
import { OptionsController } from './options/options.controller';
import { ReportsController } from './reports/reports.controller';
import { HashtagsController } from './hashtags/hashtags.controller';
import { MessagesController } from './messages/messages.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '../../.env',
    }),
    CatsModule,
  ],
  controllers: [AppController, AuthController, LegalController, PrivacyController, ContactController, FeedController, MeController, UsersController, PollsController, RoomsController, MessagesController, HashtagsController, ReportsController, OptionsController, BansController, AdminController, MetricsController, AiController, SecretsController],
  providers: [AppService, PrismaService, AdminService, AiService, AuthService, BansService, ContactService, FeedService, HashtagsService, LegalService, MeService, MessagesService, MetricsService, OptionsService, PollsService, PrivacyService, ReportsService, RoomsService, SecretsService, UsersService],
})
export class AppModule {}
