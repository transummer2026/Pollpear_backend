import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { hash, argon2id } from 'argon2';
import { randomBytes, randomUUID } from 'crypto';
import {
  GrantType,
  User,
  UserRole,
  UserTheme,
  Visibility,
} from 'src/generated/prisma/client';
import {
  type OauthCompleteSchemaDTO,
  type OauthPendingSchemaDTO,
} from 'Pollpear_shared/src/schemas/auth.schema';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { UsersService } from 'src/users/users.service';
import { OauthProfile } from './oauth-profile';

export type OauthLoginResult =
  | { status: 'user'; user: User }
  | { status: 'pending'; token: string };

@Injectable()
export class OauthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly redisService: RedisService,
  ) {}

  async handleLogin(profile: OauthProfile): Promise<OauthLoginResult> {
    const user = await this.findExistingUser(profile);
    if (!user) {
      const token = randomUUID();
      await this.redisService.setOauthPendingProfile(
        token,
        JSON.stringify(profile),
      );
      return { status: 'pending', token };
    }
    if (user.isDeleted) {
      throw new ForbiddenException('User is deleted.');
    }
    const userIsBanned = await this.usersService.findByBanStatus(user.id);
    if (userIsBanned) {
      throw new ForbiddenException('User is banned.');
    }
    await this.upsertOauth(user.id, profile);
    return { status: 'user', user };
  }

  async getPendingProfile(token: string): Promise<OauthPendingSchemaDTO> {
    const profile = await this.loadPendingProfile(token);
    return {
      email: profile.email,
      username: profile.username,
      name: profile.name,
      surname: profile.surname,
      avatarUrl: profile.avatarUrl,
    };
  }

  async completeSignup(body: OauthCompleteSchemaDTO): Promise<User> {
    const profile = await this.loadPendingProfile(body.token);
    const usernameTaken = await this.prisma.user.findUnique({
      where: { username: body.username },
    });
    if (usernameTaken) {
      throw new ConflictException('Username already taken.');
    }
    const emailTaken = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });
    if (emailTaken) {
      throw new ConflictException('An account with this email already exists.');
    }
    const passwordHash = await hash(randomBytes(32).toString('hex'), {
      type: argon2id,
    });
    const user = await this.prisma.user.create({
      data: {
        username: body.username,
        name: body.name ?? profile.name,
        surname: body.surname ?? profile.surname,
        email: profile.email,
        birthdate: body.birthdate,
        passwordHash,
        role: UserRole.user,
        gender: body.gender,
        nationality: body.nationality,
        city: body.city,
        state: body.state,
        country: body.country,
        company: body.company,
        score: 0,
        isOnline: false,
        isDeleted: false,
        visibility: Visibility.private,
        userTheme: UserTheme.light,
        ...(profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
      },
    });
    await this.upsertOauth(user.id, profile);
    await this.redisService.deleteOauthPendingProfile(body.token);
    return user;
  }

  private async loadPendingProfile(token: string): Promise<OauthProfile> {
    if (!token) {
      throw new UnauthorizedException('Signup session expired.');
    }
    const raw = await this.redisService.getOauthPendingProfile(token);
    if (!raw) {
      throw new UnauthorizedException('Signup session expired.');
    }
    const parsed = JSON.parse(raw) as Omit<OauthProfile, 'expiresAt'> & {
      expiresAt: string;
    };
    return { ...parsed, expiresAt: new Date(parsed.expiresAt) };
  }

  private async findExistingUser(profile: OauthProfile): Promise<User | null> {
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

    return null;
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
