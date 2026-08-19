import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PresenceService {
  constructor(private prisma: PrismaService) {}

  async setOnline(userId: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isOnline: true },
    });
  }

  async setOffline(userId: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isOnline: false, lastSeenAt: new Date() },
    });
  }

  async resetAll(): Promise<number> {
    const { count } = await this.prisma.user.updateMany({
      where: { isOnline: true },
      data: { isOnline: false },
    });
    return count;
  }
}
