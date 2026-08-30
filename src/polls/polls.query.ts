import { z } from 'zod';

/**
 * `GET /polls?voted=` — when present and `true`, the list is narrowed to
 * the polls the caller has voted on. Any value other than `true`/`false`
 * is a 400, not a silently ignored param (every other query param in the
 * repo goes through its own ZodValidationPipe).
 */
export const VotedFilterSchema = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => value === 'true');

export type VotedFilter = z.infer<typeof VotedFilterSchema>;
