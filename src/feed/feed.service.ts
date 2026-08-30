import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { accessibleBy } from 'src/casl/casl-prisma';
import { PollsService, getPollIncludeArgs } from 'src/polls/polls.service';
import { AiService } from 'src/ai/ai.service';
import type { User } from 'src/generated/prisma/client';
import type { PollReadDTO } from 'Pollpear_shared/src/schemas/polls.schema';

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly abilityFactory: CaslAbilityFactory,
    private readonly pollsService: PollsService,
    private readonly aiService: AiService,
  ) {}

  /**
   * The personalised feed. The AI recommender ranks candidate polls for the
   * viewer; we hydrate those ids from the database under the same CASL read
   * policy as GET /polls, shape them exactly like GET /polls, and hand them
   * back in the model's order.
   *
   * A poll the policy hides is dropped. If the recommender is unavailable
   * the call fails (503, raised by {@link AiService.getFeed}) — no unranked
   * fallback.
   *
   * @param viewer - the account the gateway resolved from `x-user-id`
   * @param limit - how many ranked polls to ask the recommender for
   * @returns polls parsed against `PollReadSchema`, best ranked first
   */
  async getFeed(viewer: User, limit: number): Promise<PollReadDTO[]> {
    const ranked = await this.aiService.getFeed(viewer.id, limit);
    const rankedIds = ranked.map((entry) => entry.poll_id);
    if (rankedIds.length === 0) {
      return [];
    }

    const ability = this.abilityFactory.createForUser(viewer);
    const [polls, votesMadeByUser] = await Promise.all([
      this.prisma.poll.findMany({
        where: {
          AND: [
            accessibleBy(ability, 'read').ofType('Poll'),
            { id: { in: rankedIds }, deletedAt: null },
          ],
        },
        include: getPollIncludeArgs(),
      }),
      this.prisma.vote.findMany({
        where: { createdById: viewer.id, deletedAt: null },
      }),
    ]);

    const shaped = this.pollsService.shapeManyPollsForUser(
      polls,
      votesMadeByUser,
    );
    const byId = new Map(shaped.map((poll) => [poll.id, poll]));

    const ordered: PollReadDTO[] = [];
    for (const id of rankedIds) {
      const poll = byId.get(id);
      if (poll) {
        ordered.push(poll);
      }
    }

    const hidden = rankedIds.length - ordered.length;
    if (hidden > 0) {
      this.logger.debug(
        `dropped ${hidden} ranked poll(s) the read policy hides from user ${viewer.id}`,
      );
    }

    return ordered;
  }
}
