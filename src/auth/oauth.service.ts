import { ForbiddenException, Injectable } from '@nestjs/common';
import { hash, argon2id } from 'argon2';
import { randomBytes } from 'crypto';
import {
  Gender,
  GrantType,
  User,
  UserRole,
  UserTheme,
  Visibility,
} from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { OauthProfile } from './oauth-profile';

@Injectable()
export class OauthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async handleLogin(profile: OauthProfile): Promise<User> {
    const user = await this.findOrCreateUser(profile);
    if (user.isDeleted) {
      throw new ForbiddenException('User is deleted.');
    }
    const userIsBanned = await this.usersService.findByBanStatus(user.id);
    if (userIsBanned) {
      throw new ForbiddenException('User is banned.');
    }
    await this.upsertOauth(user.id, profile);
    return user;
  }

  private async findOrCreateUser(profile: OauthProfile): Promise<User> {
    const existingOauth = await this.prisma.oauth.findUnique({
      where: {
        provider_providerUserId: {
          provider: profile.provider,
          providerUserId: profile.providerUserId,
        },
      },
      include: { user: true },
    });
    if (existingOauth) return existingOauth.user;

    const existingUser = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });
    if (existingUser) {
      if (!profile.emailVerified) {
        throw new ForbiddenException(
          'An account with this email already exists.',
        );
      }
      return existingUser;
    }

    return this.createUser(profile);
  }

  private async createUser(profile: OauthProfile): Promise<User> {
    const usernameTaken = await this.prisma.user.findUnique({
      where: { username: profile.username },
    });
    const username = usernameTaken
      ? `${profile.username}-${profile.providerUserId}`
      : profile.username;
    const passwordHash = await hash(randomBytes(32).toString('hex'), {
      type: argon2id,
    });
    return this.prisma.user.create({
      data: {
        username,
        name: profile.name,
        surname: profile.surname,
        email: profile.email,
        birthdate: new Date(0),
        passwordHash,
        role: UserRole.user,
        gender: Gender.prefer_not_to_say,
        nationality: '',
        score: 0,
        isOnline: false,
        isDeleted: false,
        visibility: Visibility.private,
        userTheme: UserTheme.light,
        ...(profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
      },
    });
  }

  private async upsertOauth(userId: number, profile: OauthProfile) {
    const tokens = {
      providerUrl: profile.providerUrl,
      accessToken: profile.accessToken,
      refreshToken: profile.refreshToken,
      tokenType: profile.tokenType,
      expiresAt: profile.expiresAt,
      scope: profile.scope,
      grantType: GrantType.authorization_code,
    };
    await this.prisma.oauth.upsert({
      where: {
        provider_providerUserId: {
          provider: profile.provider,
          providerUserId: profile.providerUserId,
        },
      },
      update: tokens,
      create: {
        provider: profile.provider,
        providerUserId: profile.providerUserId,
        userId,
        ...tokens,
      },
    });
  }
}
