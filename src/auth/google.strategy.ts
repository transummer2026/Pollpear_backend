import { ForbiddenException, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  Profile,
  Strategy as GoogleOauth2Strategy,
} from 'passport-google-oauth20';
import { OauthProvider } from 'src/generated/prisma/client';
import { VaultService } from 'src/vault/vault.service';
import { OauthService, type OauthLoginResult } from './oauth.service';
import { OauthStateStore } from './oauth-state.store';
import { OauthProfile } from './oauth-profile';

interface GoogleTokenParams {
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(
  GoogleOauth2Strategy,
  OauthProvider.google,
  true,
) {
  constructor(
    vault: VaultService,
    stateStore: OauthStateStore,
    private readonly oauthService: OauthService,
  ) {
    const creds = vault.oauth.google;
    super({
      clientID: creds.client_id,
      clientSecret: creds.client_secret,
      callbackURL: creds.redirect_uri,
      scope: ['email', 'profile'],
      state: true,
      store: stateStore,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    params: GoogleTokenParams,
    profile: Profile,
  ): Promise<OauthLoginResult> {
    const email = profile.emails?.[0];
    if (!email?.value) {
      throw new ForbiddenException('No email available from google account');
    }
    const normalized: OauthProfile = {
      provider: OauthProvider.google,
      providerUserId: profile.id,
      providerUrl: 'https://accounts.google.com',
      email: email.value,
      emailVerified: email.verified,
      username: email.value.split('@')[0],
      name: profile.name?.givenName ?? null,
      surname: profile.name?.familyName ?? null,
      avatarUrl: profile.photos?.[0]?.value ?? null,
      accessToken,
      refreshToken: refreshToken ?? '',
      tokenType: params.token_type ?? 'bearer',
      expiresAt: new Date(Date.now() + (params.expires_in ?? 3600) * 1000),
      scope: params.scope ?? 'email profile',
    };
    return this.oauthService.handleLogin(normalized);
  }
}
