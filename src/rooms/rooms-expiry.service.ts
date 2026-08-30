import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { closeExpiredRooms } from './room-status';

/**
 * Backstop for the per-request `status` reconciliation in `RoomsService`
 * (`syncRoomStatuses`): a room whose `endsAt` lapses is flipped to
 * `status: 'closed'` the next time anyone reads or acts on it, but a room
 * nobody touches again would keep a stale `status: 'active'` forever. This
 * sweep closes those on a fixed cadence so the column stays correct without
 * traffic. Authorization never depends on it — the interactive paths
 * already reconcile before deciding — it just keeps the stored value and
 * any query that reads `room.status` directly (e.g. a profile's poll list)
 * honest.
 */
@Injectable()
export class RoomsExpiryService {
  private readonly logger = new Logger(RoomsExpiryService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async closeExpiredRooms(): Promise<void> {
    const closed = await closeExpiredRooms(this.prisma);
    if (closed > 0) {
      this.logger.log(`closed ${closed} expired room(s)`);
    }
  }
}
