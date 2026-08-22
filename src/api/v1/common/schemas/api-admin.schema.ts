// src/api/v1/common/schemas/api-admin.schema.ts
import { z } from 'zod';
import { UserSchema as UserModel } from 'Pollpear_shared/src/prisma/schemas/models/User.schema';
import {
  Gender,
  UserRole,
  UserTheme,
  Visibility,
} from 'src/generated/prisma/enums';
import { apiPageOf } from './api-pagination.schema';

export const ApiStaffListItemSchema = UserModel.pick({
  id: true,
  username: true,
  avatarUrl: true,
  role: true,
}).extend({
  avatarUrl: z.url().nullable(),
  role: z.enum(UserRole),
});

export const ApiStaffPageSchema = apiPageOf(ApiStaffListItemSchema);

/**
 * Every scalar of the model but the password hash, deletedAt included: an
 * admin has to see that an account is gone, which is exactly what the public
 * routes hide. Split from the counts so this half can drive the select.
 *
 * Listed one by one rather than omitted from the model: a column added
 * upstream must not walk into a public payload on its own.
 */
export const ApiAdminUserColumnsSchema = UserModel.pick({
  id: true,
  username: true,
  name: true,
  surname: true,
  email: true,
  birthdate: true,
  role: true,
  gender: true,
  nationality: true,
  city: true,
  state: true,
  country: true,
  company: true,
  bio: true,
  score: true,
  isOnline: true,
  isEmailVerified: true,
  visibility: true,
  lastSeenAt: true,
  avatarUrl: true,
  bannerUrl: true,
  userTheme: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
}).extend({
  name: z.string().nullable(),
  surname: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  company: z.string().nullable(),
  bio: z.string().nullable(),
  lastSeenAt: z.date().nullable(),
  deletedAt: z.date().nullable(),
  role: z.enum(UserRole),
  gender: z.enum(Gender),
  visibility: z.enum(Visibility),
  userTheme: z.enum(UserTheme),
  avatarUrl: z.url().nullable(),
  bannerUrl: z.url().nullable(),
});

/**
 * A bare number is a lifetime total, because nothing in that table can be
 * undone. An object means the question "how many still count today" has an
 * answer, and the third field names what is gone in the words of its own
 * table: a poll is deleted, a ban is lifted, a key is revoked. Each of those
 * words means what the column means, so only the soft delete is a remainder
 * of the other two.
 */
const ApiDeletableCountSchema = z.object({
  total: z.number().int(),
  active: z.number().int(),
  deleted: z.number().int(),
});

const ApiBanCountSchema = z.object({
  total: z.number().int(),
  active: z.number().int(),
  lifted: z.number().int(),
});

/**
 * total and active are not a partition here: a key can be revoked and expired
 * at once, so revoked counts the flag on the row rather than the remainder.
 */
const ApiKeyCountSchema = z.object({
  total: z.number().int(),
  active: z.number().int(),
  revoked: z.number().int(),
});

const ApiModerationCountsSchema = z.object({
  pollsCreated: ApiDeletableCountSchema,
  roomsCreated: ApiDeletableCountSchema,
  votes: ApiDeletableCountSchema,
  messages: ApiDeletableCountSchema,
  bansReceived: ApiBanCountSchema,
  reportsGiven: z.number().int(),
  reportsReceived: z.number().int(),
});

const ApiAdminCountsSchema = ApiModerationCountsSchema.extend({
  apiKeys: ApiKeyCountSchema,
});

/**
 * What a moderator sees: the account as the platform shows it, plus its
 * behaviour. Identity and contact details are not part of judging conduct,
 * so they stay on the admin view, and the query pays for what it returns.
 */
export const ApiModerationUserColumnsSchema = ApiAdminUserColumnsSchema.pick({
  id: true,
  username: true,
  bio: true,
  avatarUrl: true,
  bannerUrl: true,
  score: true,
  isOnline: true,
  lastSeenAt: true,
  visibility: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const ApiModerationUserSchema = ApiModerationUserColumnsSchema.extend({
  counts: ApiModerationCountsSchema,
});

export const ApiAdminUserSchema = ApiAdminUserColumnsSchema.extend({
  counts: ApiAdminCountsSchema,
});

/**
 * deletedAt takes null and nothing else: null restores a soft deleted account,
 * which is a plain column write, while deleting one goes through DELETE. A
 * date here would be a second way to delete an account, one that skips the
 * lifecycle and leaves the owner's api keys alive and its sockets open.
 *
 * This only shapes the request body. Which of these fields a given caller
 * may actually set is a CASL question, decided per field against the
 * 'moderate'/'manage' rules in casl/permissions/user.ts.
 */
const AdminEditableColumns = ApiAdminUserColumnsSchema.pick({
  role: true,
  visibility: true,
  isEmailVerified: true,
  deletedAt: true,
}).extend({
  deletedAt: z.null(),
});

export const ApiAdminUserUpdateSchema = z
  .strictObject(AdminEditableColumns.shape)
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: 'Send at least one field to update',
  });

export type ApiStaffListItemDTO = z.infer<typeof ApiStaffListItemSchema>;
export type ApiStaffPageDTO = z.infer<typeof ApiStaffPageSchema>;
export type ApiAdminUserColumnsDTO = z.infer<typeof ApiAdminUserColumnsSchema>;
export type ApiModerationUserDTO = z.infer<typeof ApiModerationUserSchema>;
export type ApiAdminUserDTO = z.infer<typeof ApiAdminUserSchema>;
export type ApiAdminUserUpdateDTO = z.infer<typeof ApiAdminUserUpdateSchema>;
