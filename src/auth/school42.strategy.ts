import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  InternalOAuthError,
  Strategy as OAuth2Strategy,
} from 'passport-oauth2';
import { OauthProvider, User } from 'src/generated/prisma/client';
import { VaultService } from 'src/vault/vault.service';
import { OauthService } from './oauth.service';
import { OauthStateStore } from './oauth-state.store';
import { OauthProfile } from './oauth-profile';

interface School42RawProfile {
  id: number;
  email: string;
  login: string;
  first_name: string | null;
  last_name: string | null;
  image: { link: string | null } | null;
}

interface School42TokenParams {
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

@Injectable()
export class School42Strategy extends PassportStrategy(
  OAuth2Strategy,
  OauthProvider.school42,
  true,
) {
  constructor(
    vault: VaultService,
    stateStore: OauthStateStore,
    private readonly oauthService: OauthService,
  ) {
    const creds = vault.oauth['42'];
    super({
      authorizationURL: 'https://api.intra.42.fr/oauth/authorize',
      tokenURL: 'https://api.intra.42.fr/oauth/token',
      clientID: creds.client_id,
      clientSecret: creds.client_secret,
      callbackURL: creds.redirect_uri,
      scope: 'public',
      state: true,
      store: stateStore,
    });
    this._oauth2.useAuthorizationHeaderforGET(true);
  }

  userProfile(
    accessToken: string,
    done: (err?: Error | null, profile?: School42RawProfile) => void,
  ) {
    this._oauth2.get(
      'https://api.intra.42.fr/v2/me',
      accessToken,
      (err, body) => {
        if (err) {
          return done(
            new InternalOAuthError('Failed to fetch 42 profile', err),
          );
        }
        try {
          done(null, JSON.parse(String(body)) as School42RawProfile);
        } catch {
          done(new Error('Failed to parse 42 profile'));
        }
      },
    );
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    params: School42TokenParams,
    profile: School42RawProfile,
  ): Promise<User> {
    const normalized: OauthProfile = {
      provider: OauthProvider.school42,
      providerUserId: String(profile.id),
      providerUrl: `https://profile.intra.42.fr/users/${profile.login}`,
      email: profile.email,
      emailVerified: true,
      username: profile.login,
      name: profile.first_name,
      surname: profile.last_name,
      avatarUrl: profile.image?.link ?? null,
      accessToken,
      refreshToken,
      tokenType: params.token_type ?? 'bearer',
      expiresAt: new Date(Date.now() + (params.expires_in ?? 7200) * 1000),
      scope: params.scope ?? 'public',
    };
    return this.oauthService.handleLogin(normalized);
  }
}
