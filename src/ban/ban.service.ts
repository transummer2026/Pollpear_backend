import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class BanService {
  constructor(private prisma: PrismaService) {}

  ban(id: number) {
    return `ban user #${id} works`;
  }

  updateBan(id: number) {
    return `updated ban for user #${id} works`;
  }

  async findByBanStatus(userId: number) {
    return await this.prisma.ban.findFirst({
      where: {
        userId,
        endedAt: {
          gt: new Date(),
        },
      },
    });
  }
}
