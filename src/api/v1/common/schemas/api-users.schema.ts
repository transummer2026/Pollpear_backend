// src/api/v1/common/schemas/api-users.schema.ts
import { z } from 'zod';
import { apiPageOf } from './api-pagination.schema';

export const ApiUserListItemSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  avatarUrl: z.url().nullable(),
  score: z.number().int(),
});

export const ApiUserPageSchema = apiPageOf(ApiUserListItemSchema);

export const ApiUserSchema = z.object({
  username: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.url().nullable(),
  score: z.number().int(),
  pearsPals: z.number().int(),
  activeRooms: z.number().int(),
  pollsCreated: z.number().int(),
});

export type ApiUserListItemDTO = z.infer<typeof ApiUserListItemSchema>;
export type ApiUserPageDTO = z.infer<typeof ApiUserPageSchema>;
export type ApiUserDTO = z.infer<typeof ApiUserSchema>;
