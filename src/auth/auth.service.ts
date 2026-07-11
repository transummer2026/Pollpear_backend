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
} from 'Pollpear_shared/src/schemas/auth.schema';
import { UserRole, Visibility, UserTheme } from 'src/generated/prisma/client';
import { hash, argon2id, verify } from 'argon2';
import { UserDTO } from 'Pollpear_shared/src/schemas/users.schema';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { RedisService } from 'src/redis/redis.service';
import { type Response } from 'express';

@Injectable()
export class AuthService {
  private readonly pepper: Buffer;
  constructor(
    private prisma: PrismaService,
    private readonly userService: UsersService,
    private readonly redisService: RedisService,
  ) {
    const pepper = process.env.NESTJS_PEPPER;
    if (!pepper) throw new Error('NESTJS_PEPPER is not defined');
    this.pepper = Buffer.from(pepper);
  }

  async login(body: LoginDTO, @Res({ passthrough: true }) response: Response) {
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

    const sessionId = this.userService.generateSessionId();

    await this.redisService.setRedisCache(sessionId, user.id);

    response.cookie('sessionId', sessionId, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 1000,
    });
  }

  logout() {
    return 'logout route works';
  }

  /**
   * using primsa ommit is more sercure than zod as zod
   */
  async register(body: RegisterDTO): Promise<UserDTO> {
    let passwordHash: string;
    try {
      passwordHash = await hash(body.password, {
        hashLength: 32,
        timeCost: 3,
        parallelism: 4,
        memoryCost: 2 ** 16,
        type: argon2id,
        secret: this.pepper,
      });
    } catch (e) {
      throw new InternalServerErrorException(e);
    }
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

  passwordForgot() {
    return 'password forgot route works';
  }

  passwordReset() {
    return 'password reset route works';
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
