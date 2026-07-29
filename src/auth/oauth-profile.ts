import { OauthProvider } from 'src/generated/prisma/client';

export interface OauthProfile {
  provider: OauthProvider;
  providerUserId: string;
  providerUrl: string;
  email: string;
  emailVerified: boolean;
  username: string;
  name: string | null;
  surname: string | null;
  avatarUrl: string | null;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: Date;
  scope: string;
}
