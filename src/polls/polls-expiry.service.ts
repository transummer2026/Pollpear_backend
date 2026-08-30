import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { closeExpiredPolls } from './poll-status';

/**
 * Backstop for the per-request reconciliation in `PollsService` and
 * `VotesService` (`syncPollStatuses`): a poll whose `endsAt` lapses — or
 * whose room's does — is flipped to `status: 'closed'` the next time
 * anyone reads or votes on it, but a poll nobody touches again would keep
 * a stale `status` forever. This sweep closes those on a fixed cadence so
 * the stored value, and anything that reads it directly, stays honest
 * without traffic. Authorization never depends on it — the interactive
 * paths reconcile before deciding — it just keeps the column correct.
 * Mirrors `RoomsExpiryService`.
 */
@Injectable()
export class PollsExpiryService {
  private readonly logger = new Logger(PollsExpiryService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async closeExpiredPolls(): Promise<void> {
    const closed = await closeExpiredPolls(this.prisma);
    if (closed > 0) {
      this.logger.log(`closed ${closed} expired poll(s)`);
    }
  }
}
