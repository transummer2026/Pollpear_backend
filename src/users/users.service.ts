import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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

  update(id: number) {
    return `update user #${id} works`;
  }

  remove(id: number) {
    return `remove user #${id} works`;
  }

  // PRISMA REQUESTS

  async findByUserId(userId: string) {
    return await this.prisma.user.findUnique({
      where: { id: Number(userId) },
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
}
