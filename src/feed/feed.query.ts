import { z } from 'zod';

/**
 * GET /feed takes one optional `limit`, forwarded as-is to the AI
 * recommender. The client picks the value (its page size); the recommender
 * caps it again on its side.
 */
export const FEED_DEFAULT_LIMIT = 25;
export const FEED_MAX_LIMIT = 50;

export const FeedQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(FEED_MAX_LIMIT)
    .default(FEED_DEFAULT_LIMIT),
});

export type FeedQueryDTO = z.infer<typeof FeedQuerySchema>;
