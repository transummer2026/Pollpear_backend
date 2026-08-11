import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { randomUUID } from 'crypto';
import {
  UserDTO,
  UserSchema,
  type UserProfileUpdateDTO,
} from 'Pollpear_shared/src/schemas/users.schema';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { ForbiddenError, subject } from '@casl/ability';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private abilityFactory: CaslAbilityFactory,
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

  async update(
    id: number,
    userId: number,
    body: UserProfileUpdateDTO,
  ): Promise<UserDTO> {
    const requester = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const target = await this.prisma.user.findUniqueOrThrow({ where: { id } });

    const ability = this.abilityFactory.createForUser(requester);
    ForbiddenError.from(ability).throwUnlessCan(
      'update',
      subject('User', target),
    );

    const updatedUser = await this.updateUserProfile(id, body);
    return UserSchema.parse(updatedUser);
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

  async verifyEmail(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: true },
    });
  }

  private async updateUserProfile(userId: number, data: UserProfileUpdateDTO) {
    return await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: data,
    });
  }
}
