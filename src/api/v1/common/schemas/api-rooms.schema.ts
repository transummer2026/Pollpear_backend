import { z } from 'zod';
import { RoomSchema as RoomModel } from 'Pollpear_shared/src/prisma/schemas/models/Room.schema';
import { UserSchema as UserModel } from 'Pollpear_shared/src/prisma/schemas/models/User.schema';
import { RoomStatus, Visibility } from 'src/generated/prisma/enums';
import { apiPageOf, ApiPageQuerySchema } from './api-pagination.schema';
import { endsInTheFuture } from './api-dates.schema';

export const MAX_NAME = 255;
export const MAX_DESCRIPTION = 3000;

export const ApiRoomOwnerSchema = UserModel.pick({
  id: true,
  username: true,
});

export const ApiRoomListColumnsSchema = RoomModel.pick({
  id: true,
  name: true,
  bannerUrl: true,
  visibility: true,
  status: true,
  endsAt: true,
}).extend({
  endsAt: z.date().nullable(),
  visibility: z.enum(Visibility),
  status: z.enum(RoomStatus),
});

const ApiRoomListItemSchema = ApiRoomListColumnsSchema.extend({
  memberCount: z.number().int(),
});

export const ApiRoomPageSchema = apiPageOf(ApiRoomListItemSchema);

export const ApiRoomColumnsSchema = RoomModel.pick({
  id: true,
  name: true,
  description: true,
  bannerUrl: true,
  visibility: true,
  status: true,
  endsAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  description: z.string().nullable(),
  endsAt: z.date().nullable(),
  visibility: z.enum(Visibility),
  status: z.enum(RoomStatus),
});

export const ApiRoomSchema = ApiRoomColumnsSchema.extend({
  createdBy: ApiRoomOwnerSchema,
  memberCount: z.number().int(),
  pollCount: z.number().int(),
});

export const ApiRoomCreateSchema = z.strictObject({
  name: z.string().min(1).max(MAX_NAME),
  description: z.string().max(MAX_DESCRIPTION).nullable().optional(),
  visibility: z.enum(Visibility),
  endsAt: endsInTheFuture().nullable().optional(),
});

export const ApiRoomUpdateSchema = z
  .strictObject({
    name: z.string().min(1).max(MAX_NAME),
    description: z.string().max(MAX_DESCRIPTION).nullable(),
    visibility: z.enum(Visibility),
    endsAt: endsInTheFuture().nullable(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: 'Send at least one field to update',
  });

export const ApiRoomFilterSchema = z.object({
  visibility: z.enum(Visibility).optional(),
  status: z.enum(RoomStatus).optional(),
  createdBy: z.coerce.number().int().min(1).optional(),
});

export const ApiRoomQuerySchema = ApiPageQuerySchema.extend(
  ApiRoomFilterSchema.shape,
);

export type ApiRoomListColumnsDTO = z.infer<typeof ApiRoomListColumnsSchema>;
export type ApiRoomPageDTO = z.infer<typeof ApiRoomPageSchema>;
export type ApiRoomColumnsDTO = z.infer<typeof ApiRoomColumnsSchema>;
export type ApiRoomDTO = z.infer<typeof ApiRoomSchema>;
export type ApiRoomCreateDTO = z.infer<typeof ApiRoomCreateSchema>;
export type ApiRoomUpdateDTO = z.infer<typeof ApiRoomUpdateSchema>;
export type ApiRoomFilterDTO = z.infer<typeof ApiRoomFilterSchema>;
export type ApiRoomQueryDTO = z.infer<typeof ApiRoomQuerySchema>;
export type ApiRoomOwnerDTO = z.infer<typeof ApiRoomOwnerSchema>;
