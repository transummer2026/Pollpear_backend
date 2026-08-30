import { Controller, Get, Query } from '@nestjs/common';
import { FeedService } from './feed.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CheckAbilities } from 'src/common/decorators/check-ability.decorator';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import type { User } from 'src/generated/prisma/client';
import { FeedQuerySchema, type FeedQueryDTO } from './feed.query';

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  /**
   * The caller's personalised feed. Identity is the `x-user-id` the gateway
   * derived from the session, resolved to `viewer` by the AuthGuard; there
   * is no id in the path. Returns the same poll shape as GET /polls,
   * ordered by the recommender, or 503 if the recommender is down.
   */
  @Get()
  @CheckAbilities(['read', 'Poll'])
  getFeed(
    @CurrentUser() viewer: User,
    @Query(new ZodValidationPipe(FeedQuerySchema)) query: FeedQueryDTO,
  ) {
    return this.feedService.getFeed(viewer, query.limit);
  }
}
