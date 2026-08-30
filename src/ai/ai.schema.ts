import { z } from 'zod';

/**
 * Wire shape of the AI recommender response (`GET {ai_url}/feed/{userId}`).
 * This is the boundary with the Python service, not something the backend
 * exposes: `poll_id` is snake_case because that is what FastAPI emits, and
 * every id is re-hydrated into a full `PollReadDTO` before it reaches a
 * client, so this type never leaves the backend.
 */
export const FeedEntrySchema = z.object({
  poll_id: z.number().int(),
  title: z.string(),
  score: z.number(),
});

export const FeedResponseSchema = z.object({
  user_id: z.number().int(),
  feed: z.array(FeedEntrySchema),
});

export type FeedEntry = z.infer<typeof FeedEntrySchema>;
export type FeedResponse = z.infer<typeof FeedResponseSchema>;
