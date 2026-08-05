import { ForbiddenException, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy as GithubOauth2Strategy } from 'passport-github2';
import { OauthProvider } from 'src/generated/prisma/client';
import { VaultService } from 'src/vault/vault.service';
import { OauthService, type OauthLoginResult } from './oauth.service';
import { OauthStateStore } from './oauth-state.store';
import { OauthProfile } from './oauth-profile';

interface GithubTokenParams {
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

interface GithubEmail {
  value: string;
  primary?: boolean;
  verified?: boolean;
}

@Injectable()
export class GithubStrategy extends PassportStrategy(
  GithubOauth2Strategy,
  OauthProvider.github,
  true,
) {
  constructor(
    vault: VaultService,
    stateStore: OauthStateStore,
    private readonly oauthService: OauthService,
  ) {
    const creds = vault.oauth.github;
    super({
      clientID: creds.client_id,
      clientSecret: creds.client_secret,
      callbackURL: creds.redirect_uri,
      scope: ['user:email'],
      allRawEmails: true,
      store: stateStore,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    params: GithubTokenParams,
    profile: Profile,
  ): Promise<OauthLoginResult> {
    const emails = (profile.emails ?? []) as GithubEmail[];
    const primary = emails.find((e) => e.primary) ?? emails[0];
    if (!primary?.value) {
      throw new ForbiddenException('No email available from github account');
    }
    const normalized: OauthProfile = {
      provider: OauthProvider.github,
      providerUserId: profile.id,
      providerUrl: profile.profileUrl,
      email: primary.value,
      emailVerified: primary.verified ?? false,
      username: profile.username ?? `github-${profile.id}`,
      name: profile.displayName ?? null,
      surname: null,
      avatarUrl: profile.photos?.[0]?.value ?? null,
      accessToken,
      refreshToken: refreshToken ?? '',
      tokenType: params.token_type ?? 'bearer',
      expiresAt: new Date(Date.now() + (params.expires_in ?? 31536000) * 1000),
      scope: params.scope ?? 'user:email',
    };
    return this.oauthService.handleLogin(normalized);
  }
}
