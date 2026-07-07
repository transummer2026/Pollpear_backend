import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { type RegisterDTO } from '../../Pollpear_shared/src/schemas/auth.schema';
import { PrismaService } from 'src/prisma.service';
import { UserRole, Visibility, UserTheme } from 'src/generated/prisma/client';
import * as argon2 from 'argon2';
import { UserDTO } from 'Pollpear_shared/src/schemas/users.schema';
import { Prisma } from 'src/generated/prisma/client';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  login() {
    return 'login route works';
  }

  logout() {
    return 'logout route works';
  }

  async register(body: RegisterDTO): Promise<UserDTO> {
    const passwordHash = await argon2.hash(body.password); // TODO: login verify password
    try {
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
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        switch (e.code) {
          case 'P2000':
            throw new BadRequestException(
              'Invalid data provided for user creation.',
            );
          case 'P2002':
            throw new ConflictException('User account already exists.');
          default:
            throw new InternalServerErrorException('Failed to create user');
        }
      }
      throw new InternalServerErrorException('Failed to create user');
    }
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
}
