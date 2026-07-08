import { Injectable } from '@nestjs/common';
import { type RegisterDTO } from 'Pollpear_shared/src/schemas/auth.schema';
import { UserRole, Visibility, UserTheme } from 'src/generated/prisma/client';
import { hash, argon2id } from 'argon2';
import { UserDTO } from 'Pollpear_shared/src/schemas/users.schema';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) { }

  login() {
    return 'login route works';
  }

  logout() {
    return 'logout route works';
  }

  /**
   * using primsa ommit is more sercure than zod as zod
   */
async register(body: RegisterDTO): Promise<UserDTO> {
    const passwordHash = await hash(body.password, {
      hashLength: 32,
      timeCost: 3,
      parallelism: 4,
      memoryCost: 2 ** 16,
      type: argon2id,
      secret: Buffer.from(process.env.PEPPER ?? 'pepper'),
    });
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
