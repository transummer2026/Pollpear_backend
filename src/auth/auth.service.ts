import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { type RegisterDTO } from '../../Pollpear_shared/src/schemas/auth.schema';
import { UserRole, Visibility, UserTheme } from 'src/generated/prisma/client';
import { hash, argon2id } from 'argon2';
import { UserDTO } from 'Pollpear_shared/src/schemas/users.schema';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const passwordHash = await hash('password', {
      hashLength: 32,
      timeCost: 3, // the passord will be hashed 3x like potato salad
      parallelism: 4, // 4 threads are used to compute the hash
      memoryCost: 2 ** 16,
      type: argon2id,
      secret: Buffer.from(process.env.PEPPER ?? 'pepper'),
    }); // TODO: login verify password
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
}
