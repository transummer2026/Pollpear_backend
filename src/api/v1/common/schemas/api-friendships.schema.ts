import { z } from 'zod';
import { FriendshipSchema as FriendshipModel } from 'Pollpear_shared/src/prisma/schemas/models/Friendship.schema';
import { FriendshipStatus } from 'src/generated/prisma/enums';
import { apiPageOf, ApiPageQuerySchema } from './api-pagination.schema';
import { ApiUserSummarySchema } from './api-users.schema';

export const ApiFriendshipColumnsSchema = FriendshipModel.pick({
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(FriendshipStatus),
});

export const ApiFriendshipSchema = ApiFriendshipColumnsSchema.extend({
  requester: ApiUserSummarySchema,
  addressee: ApiUserSummarySchema,
});

export const ApiFriendshipPageSchema = apiPageOf(ApiFriendshipSchema);

export const ApiFriendshipCreateSchema = z.strictObject({
  addresseeId: z.number().int().min(1),
});

/**
 * Answering means leaving `pending`, so the outcomes are derived from the enum
 * rather than copied: a value added to the model is either offered too, or
 * turns the test that freezes them red — never silently forgotten.
 */
const ANSWERS = Object.values(FriendshipStatus).filter(
  (status) => status !== FriendshipStatus.pending,
);

export const ApiFriendshipAnswerSchema = z.enum(
  ANSWERS as [FriendshipStatus, ...FriendshipStatus[]],
);

export const ApiFriendshipUpdateSchema = z.strictObject({
  status: ApiFriendshipAnswerSchema,
});

export const ApiFriendshipFilterSchema = z.object({
  status: z.enum(FriendshipStatus).optional(),
  with: z.coerce.number().int().min(1).optional(),
});

export const ApiFriendshipQuerySchema = ApiPageQuerySchema.extend(
  ApiFriendshipFilterSchema.shape,
);

export type ApiFriendshipColumnsDTO = z.infer<
  typeof ApiFriendshipColumnsSchema
>;
export type ApiFriendshipDTO = z.infer<typeof ApiFriendshipSchema>;
export type ApiFriendshipPageDTO = z.infer<typeof ApiFriendshipPageSchema>;
export type ApiFriendshipCreateDTO = z.infer<typeof ApiFriendshipCreateSchema>;
export type ApiFriendshipUpdateDTO = z.infer<typeof ApiFriendshipUpdateSchema>;
export type ApiFriendshipFilterDTO = z.infer<typeof ApiFriendshipFilterSchema>;
export type ApiFriendshipQueryDTO = z.infer<typeof ApiFriendshipQuerySchema>;
