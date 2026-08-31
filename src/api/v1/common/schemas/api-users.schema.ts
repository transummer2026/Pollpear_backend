import { z } from 'zod';
import { UserSchema as UserModel } from 'Pollpear_shared/src/prisma/schemas/models/User.schema';
import { apiPageOf } from './api-pagination.schema';

export const ApiUserStateSchema = z.enum(['blocked']);

export const ApiUserSummarySchema = UserModel.pick({
  id: true,
  username: true,
});

export const ApiUserListColumnsSchema = UserModel.pick({
  id: true,
  username: true,
  avatarUrl: true,
  score: true,
}).extend({
  avatarUrl: z.url().nullable(),
});

export const ApiUserListItemSchema = ApiUserListColumnsSchema.extend({
  state: ApiUserStateSchema.optional(),
});

export const ApiUserPageSchema = apiPageOf(ApiUserListItemSchema);

export const ApiUserColumnsSchema = UserModel.pick({
  id: true,
  username: true,
  bio: true,
  avatarUrl: true,
  score: true,
}).extend({
  bio: z.string().nullable(),
  avatarUrl: z.url().nullable(),
});

/**
 * Counted at read time from other tables, never stored on the user: there is
 * no column to derive these from.
 */
const ApiUserCountersSchema = z.object({
  pearsPals: z.number().int(),
  activeRooms: z.number().int(),
  pollsCreated: z.number().int(),
});

export const ApiUserSchema = ApiUserColumnsSchema.extend({
  ...ApiUserCountersSchema.shape,
  state: ApiUserStateSchema.optional(),
});

export type ApiUserListColumnsDTO = z.infer<typeof ApiUserListColumnsSchema>;
export type ApiUserStateDTO = z.infer<typeof ApiUserStateSchema>;
export type ApiUserPageDTO = z.infer<typeof ApiUserPageSchema>;
export type ApiUserColumnsDTO = z.infer<typeof ApiUserColumnsSchema>;
export type ApiUserDTO = z.infer<typeof ApiUserSchema>;
export type ApiUserSummaryDTO = z.infer<typeof ApiUserSummarySchema>;
