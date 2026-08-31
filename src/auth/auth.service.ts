import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
  Res,
} from '@nestjs/common';
import {
  type RegisterDTO,
  type LoginDTO,
  type PasswordForgotDTO,
  type PasswordResetDTO,
  type VerifyEmailDTO,
  type ResendVerificationDTO,
} from 'Pollpear_shared/src/schemas/auth.schema';
import {
  type User,
  UserRole,
  Visibility,
  UserTheme,
} from 'src/generated/prisma/client';
import { hash, argon2id, verify } from 'argon2';
import { UserDTO, UserSchema } from 'Pollpear_shared/src/schemas/users.schema';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { BanService } from 'src/ban/ban.service';
import { RedisService } from 'src/redis/redis.service';
import { MailService } from 'src/mail/mail.service';
import { randomUUID } from 'crypto';
import { VaultService } from 'src/vault/vault.service';
import { WebsocketEmitter } from 'src/websocket/websocket.emitter';
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
  private readonly logger = new Logger(AuthService.name);
  private readonly pepper: Buffer;
  constructor(
    private prisma: PrismaService,
    private readonly userService: UsersService,
    private readonly banService: BanService,
    private readonly redisService: RedisService,
    private readonly mailService: MailService,
    private readonly vault: VaultService,
    private readonly websocketEmitter: WebsocketEmitter,
  ) {
    const pepper = this.vault.session.pepper;
    if (!pepper) throw new Error('Vault pepper secret is not defined');
    this.pepper = Buffer.from(pepper);
  }

  async hashPassword(password: string): Promise<string> {
    try {
      return await hash(password, { ...ARGON2_OPTIONS, secret: this.pepper });
    } catch (e) {
      this.logger.error('Failed to hash password', e);
      throw new InternalServerErrorException(e);
    }
  }

  async verifyPassword(user: User | null, password: string): Promise<boolean> {
    let passwordValid: boolean;
    try {
      const DUMMYHASH =
        '$argon2id$v=19$m=65536,t=3,p=4$hQzqkGQTCVjMXHDAHWALtQ$bquAvFbQv9OIgSxZP4H5OXyFvSwrRvnbolFRUJd70+0';
      passwordValid = await verify(user?.passwordHash ?? DUMMYHASH, password, {
        secret: this.pepper,
      });
    } catch (e) {
      this.logger.error('Failed to verify password', e);
      throw new InternalServerErrorException(e);
    }
    if (!user || !passwordValid) {
      this.logger.debug(
        `Password verification failed for user ${user?.id ?? 'unknown'}`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    return true;
  }

  async register(body: RegisterDTO): Promise<UserDTO> {
    const passwordHash = await this.hashPassword(body.password);
    const user = await this.prisma.user.create({
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
        isEmailVerified: false,
        visibility: Visibility.public,
        userTheme: UserTheme.light,
      },
      omit: {
        passwordHash: true,
        updatedAt: true,
      },
    });

    try {
      await this.sendVerificationEmail(user.email, user.id);
    } catch (error) {
      await this.prisma.user.delete({ where: { id: user.id } });
      this.logger.warn(
        `registration rolled back for user ${user.id}: verification email refused`,
        error,
      );
      throw new BadRequestException(
        'We could not send the verification email to this address. ' +
          'Check it and try again.',
      );
    }

    return user;
  }

  async login(
    body: LoginDTO,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserDTO> {
    const user = await this.userService.findByEmail(body.email);

    await this.verifyPassword(user, body.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (user.deletedAt) {
      throw new ForbiddenException('User is deleted.');
    }

    if (!user.isEmailVerified) {
      throw new ForbiddenException('Email not verified.');
    }

    const userisBanned = await this.banService.findByBanStatus(user.id);
    if (userisBanned) {
      throw new ForbiddenException('User is banned.');
    }

    await this.createSession(user.id, response);

    return UserSchema.parse(user);
  }

  async oauthLogin(userId: number, response: Response): Promise<void> {
    await this.createSession(userId, response);
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

  /**
   * The session itself is already destroyed in Redis by the gateway at
   * this point; what is left is closing the websocket tunnels opened
   * with it, otherwise they would outlive the session.
   */
  async logout(userId: number) {
    await this.websocketEmitter.revokeUser(userId);
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
    } catch (error) {
      this.logger.error('Failed to send password reset email', error);
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

  async verifyEmail(body: VerifyEmailDTO): Promise<void> {
    const userId = await this.redisService.getEmailVerifyToken(body.token);
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired verification token');
    }

    await this.userService.verifyEmail(userId);
    await this.redisService.deleteEmailVerifyToken(body.token, userId);
  }

  async resendVerification(body: ResendVerificationDTO): Promise<void> {
    const user = await this.userService.findByEmail(body.email);
    if (!user || user.isEmailVerified) {
      return;
    }

    await this.sendVerificationEmail(user.email, user.id);
  }

  private async sendVerificationEmail(
    email: string,
    userId: number,
  ): Promise<void> {
    const token = randomUUID();
    await this.redisService.setEmailVerifyToken(token, userId);

    const verifyUrl = `${this.vault.app.frontend_url}/auth/verify-email?token=${token}`;
    try {
      await this.mailService.sendVerificationEmail(email, verifyUrl);
    } catch (error) {
      this.logger.error('Failed to send verification email', error);
      throw new InternalServerErrorException(
        'Failed to send verification email',
      );
    }
  }
}
