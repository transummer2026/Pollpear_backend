// src/api/v1/common/schemas/api-pagination.schema.ts
import { z } from 'zod';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const ApiPageQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
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
