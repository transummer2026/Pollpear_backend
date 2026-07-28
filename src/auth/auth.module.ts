import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module';
import { MailModule } from 'src/mail/mail.module';
import { OauthService } from './oauth.service';
import { OauthStateStore } from './oauth-state.store';
import { OauthGuard } from './oauth.guard';
import { School42Strategy } from './school42.strategy';
import { GoogleStrategy } from './google.strategy';
import { GithubStrategy } from './github.strategy';

@Module({
  imports: [UsersModule, MailModule, PassportModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    OauthService,
    OauthStateStore,
    OauthGuard,
    School42Strategy,
    GoogleStrategy,
    GithubStrategy,
  ],
})
export class AuthModule {}
