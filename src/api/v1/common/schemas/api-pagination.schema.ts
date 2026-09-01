import { z } from 'zod';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;

/**
 * How many rows one page may carry, by role. The schema cannot know who is
 * asking, so it validates against the highest ceiling and the service refuses
 * anything above the caller's own. Nothing is ever clamped: a limit past the
 * ceiling is a client mistake, and answering 100 to a request for 1000 would
 * let the caller believe it reached the end of the list.
 */
export const LIMIT_BY_ROLE = {
  user: 50,
  moderator: 100,
  admin: 1000,
} as const;

const HIGHEST_LIMIT = LIMIT_BY_ROLE.admin;

export const ApiPageQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(HIGHEST_LIMIT)
    .default(DEFAULT_LIMIT),
});

export type ApiPageQueryDTO = z.infer<typeof ApiPageQuerySchema>;

export function apiPageOf<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
  });
}

export function skipFor(query: ApiPageQueryDTO): number {
  return (query.page - 1) * query.limit;
}
