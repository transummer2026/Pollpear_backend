// src/api/v1/common/schemas/api-users.schema.ts
import { z } from 'zod';
import { UserSchema as UserModel } from 'Pollpear_shared/src/prisma/schemas/models/User.schema';
import { apiPageOf } from './api-pagination.schema';

/**
 * state is only present when there is something to report, and only what
 * the caller is entitled to know: blocked is their own doing, banned and
 * deleted are staff information. It is decided at read time, so it is the
 * one field here with no column behind it.
 */
export const ApiUserStateSchema = z.enum(['blocked', 'banned', 'deleted']);

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
