import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { randomUUID } from 'crypto';
import {
  UserDTO,
  UserDTOSchema,
  type UserProfileUpdateDTO,
} from 'Pollpear_shared/src/schemas/users.schema';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory/casl-ability.factory';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private casabilityFactory: CaslAbilityFactory,
  ) {}

  report(id: number) {
    return `report user #${id} works`;
  }

  block(id: number) {
    return `block user #${id} works`;
  }

  createFriendRequest(id: number) {
    return `send friendship request to user #${id} works`;
  }

  updateFriendRequest(id: number) {
    return `update friendship with user #${id} works`;
  }

  removeFriendship(id: number) {
    return `delete friendship with user #${id} works`;
  }

  ban(id: number) {
    return `ban user #${id} works`;
  }

  updateBan(id: number) {
    return `updated ban for user #${id} works`;
  }

  async update(id: number, body: UserProfileUpdateDTO): Promise<UserDTO> {
    const user = await this.updateUserProfile(id, body);
    return UserDTOSchema.parse(user);
  }

  remove(id: number) {
    return `remove user #${id} works`;
  }

  // PRISMA REQUESTS

  async findByUserId(userId: number) {
    if (isNaN(userId)) throw new ForbiddenException('Invalid user id.');
    return await this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  async findByEmail(email: string) {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByBanStatus(userId: number) {
    return await this.prisma.ban.findFirst({
      where: {
        userId,
        unbannedAt: {
          gt: new Date(),
        },
      },
    });
  }

  generateSessionId() {
    return randomUUID();
  }

  async updatePassword(userId: number, passwordHash: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  private async updateUserProfile(userId: number, body: UserProfileUpdateDTO) {
    return await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        username: body.username,
        email: body.email,
        birthdate: body.birthdate,
        gender: body.gender,
        nationality: body.nationality,
        name: body.name,
        surname: body.surname,
        city: body.city,
        state: body.state,
        country: body.country,
        company: body.company,
        bio: body.bio,
      },
    });
  }
}
