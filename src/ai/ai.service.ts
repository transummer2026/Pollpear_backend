import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { VaultService } from 'src/vault/vault.service';
import { FeedResponseSchema, type FeedEntry } from './ai.schema';

/**
 * The recommender trains in memory and answers fast; a slow reply means it
 * is unhealthy, so we cut the call rather than let a request hang on it.
 */
const AI_REQUEST_TIMEOUT_MS = 2000;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly vault: VaultService) {}

  /**
   * Asks the AI recommender for a user's ranked feed, best score first.
   * The recommender already scopes candidates to active public polls and
   * drops the ones the user voted on or blocked the author of; the backend
   * still re-checks every id against the CASL read policy afterwards.
   *
   * @throws ServiceUnavailableException when the recommender is
   * unreachable, times out, or answers with an unexpected shape. There is
   * no unranked fallback: a feed without the model is not a feed.
   */
  async getFeed(userId: number, limit: number): Promise<FeedEntry[]> {
    const url = `${this.vault.app.ai_url}/feed/${userId}?limit=${limit}`;

    let payload: unknown;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`recommender answered ${response.status}`);
      }
      payload = await response.json();
    } catch (error) {
      this.logger.error(
        `feed for user ${userId} unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new ServiceUnavailableException('Feed is temporarily unavailable');
    }

    const parsed = FeedResponseSchema.safeParse(payload);
    if (!parsed.success) {
      this.logger.error(
        `recommender returned an unexpected shape for user ${userId}`,
      );
      throw new ServiceUnavailableException('Feed is temporarily unavailable');
    }

    return parsed.data.feed;
  }
}
