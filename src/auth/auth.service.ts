import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  Res,
} from '@nestjs/common';
import {
  type RegisterDTO,
  type LoginDTO,
  type PasswordForgotDTO,
  type PasswordResetDTO,
} from 'Pollpear_shared/src/schemas/auth.schema';
import { UserRole, Visibility, UserTheme } from 'src/generated/prisma/client';
import { hash, argon2id, verify } from 'argon2';
import {
  UserDTO,
  UserDTOSchema,
} from 'Pollpear_shared/src/schemas/users.schema';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { RedisService } from 'src/redis/redis.service';
import { MailService } from 'src/mail/mail.service';
import { randomUUID } from 'crypto';
import { VaultService } from 'src/vault/vault.service';
import { type Response } from 'express';

const ARGON2_OPTIONS = {
  hashLength: 32,
  timeCost: 3,
  parallelism: 4,
  memoryCost: 2 ** 16,
  type: argon2id,
};

@Injectable()
export class AuthService {
  private readonly pepper: Buffer;
  constructor(
    private prisma: PrismaService,
    private readonly userService: UsersService,
    private readonly redisService: RedisService,
    private readonly mailService: MailService,
    private readonly vault: VaultService,
  ) {
    const pepper = this.vault.session.pepper;
    if (!pepper) throw new Error('Vault pepper secret is not defined');
    this.pepper = Buffer.from(pepper);
  }

  private async hashPassword(password: string): Promise<string> {
    try {
      return await hash(password, { ...ARGON2_OPTIONS, secret: this.pepper });
    } catch (e) {
      throw new InternalServerErrorException(e);
    }
  }

  /**
   * using primsa ommit is more sercure than zod as zod
   */
  async register(body: RegisterDTO): Promise<UserDTO> {
    const passwordHash = await this.hashPassword(body.password);
    return await this.prisma.user.create({
      data: {
        username: body.username,
        name: body.name,
        surname: body.surname,
        email: body.email,
        birthdate: body.birthdate,
        passwordHash: passwordHash,
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
      },
      omit: {
        passwordHash: true,
        updatedAt: true,
      },
    });
  }

  async login(
    body: LoginDTO,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserDTO> {
    const user = await this.userService.findByEmail(body.email);

    const userIsDeleted = user?.isDeleted;

    let passwordValid: boolean;
    try {
      const DUMMYHASH =
        '$argon2id$v=19$m=65536,t=3,p=4$hQzqkGQTCVjMXHDAHWALtQ$bquAvFbQv9OIgSxZP4H5OXyFvSwrRvnbolFRUJd70+0';
      passwordValid = await verify(
        user?.passwordHash ?? DUMMYHASH,
        body.password,
        {
          secret: this.pepper,
        },
      );
    } catch (e) {
      throw new InternalServerErrorException(e);
    }
    if (!user || !passwordValid)
      throw new UnauthorizedException('Invalid credentials');

    const userisBanned = await this.userService.findByBanStatus(user.id);
    if (userisBanned) {
      throw new ForbiddenException('User is banned.');
    }

    if (userIsDeleted) {
      throw new ForbiddenException('User is deleted.');
    }

    await this.createSession(user.id, response);

    return UserDTOSchema.parse(user);
  }

  private async createSession(userId: number, response: Response) {
    const sessionId = this.userService.generateSessionId();

    await this.redisService.setRedisCache(sessionId, userId);

    response.cookie('sid', sessionId, {
      // TODO: add secure: true for PROD
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 1000,
    });
  }

  logout() {
    return 'logout route works';
  }

  async passwordForgot(body: PasswordForgotDTO): Promise<void> {
    const user = await this.userService.findByEmail(body.email);

    if (!user) {
      return;
    }

    const token = randomUUID();
    await this.redisService.setPasswordResetToken(token, user.id);

    const resetUrl = `${this.vault.app.frontend_url}/auth/change-password?token=${token}`;
    try {
      await this.mailService.sendPasswordResetEmail(user.email, resetUrl);
    } catch {
      throw new InternalServerErrorException('Failed to send reset email');
    }
  }

  async passwordReset(body: PasswordResetDTO): Promise<void> {
    const userId = await this.redisService.getPasswordResetToken(body.token);
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const passwordHash = await this.hashPassword(body.password);

    await this.userService.updatePassword(userId, passwordHash);
    await this.redisService.deletePasswordResetToken(body.token, userId);
  }

  oauth(provider: string) {
    // redirection to the provider happens here
    return `Oauth with ${provider} works`;
  }

  callback() {
    return 'callback route works';
  }

  //Prisma request functions
}
