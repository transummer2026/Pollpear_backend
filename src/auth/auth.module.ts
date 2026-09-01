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
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { RevocationModule } from 'src/revocation/revocation.module';

@Module({
  imports: [UsersModule, MailModule, PassportModule, RevocationModule],
  exports: [AuthService],
  controllers: [AuthController],
  providers: [
    OauthService,
    OauthStateStore,
    OauthGuard,
    School42Strategy,
    GoogleStrategy,
    GithubStrategy,
    AuthService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AuthModule {}
