// src/api/v1/common/schemas/api-me.schema.ts
import { z } from 'zod';
import { UserSchema as UserModel } from 'Pollpear_shared/src/prisma/schemas/models/User.schema';
import {
  Gender,
  UserRole,
  UserTheme,
  Visibility,
} from 'src/generated/prisma/enums';

const MeColumns = UserModel.pick({
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
});

export const ApiMeSchema = MeColumns.extend({
  name: z.string().nullable(),
  surname: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  company: z.string().nullable(),
  bio: z.string().nullable(),
  lastSeenAt: z.date().nullable(),
  role: z.enum(UserRole),
  gender: z.enum(Gender),
  visibility: z.enum(Visibility),
  userTheme: z.enum(UserTheme),
  avatarUrl: z.url().nullable(),
  bannerUrl: z.url().nullable(),
});

export type ApiMeDTO = z.infer<typeof ApiMeSchema>;

const EditableText = z.string().max(255).nullable();

const MeEditableColumns = ApiMeSchema.pick({
  name: true,
  surname: true,
  bio: true,
  city: true,
  state: true,
  country: true,
  company: true,
  gender: true,
  visibility: true,
  userTheme: true,
}).extend({
  name: EditableText,
  surname: EditableText,
  bio: EditableText,
  city: EditableText,
  state: EditableText,
  country: EditableText,
  company: EditableText,
});

export const ApiMeUpdateSchema = z
  .strictObject(MeEditableColumns.shape)
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: 'Send at least one field to update',
  });

export type ApiMeUpdateDTO = z.infer<typeof ApiMeUpdateSchema>;

export const ApiMeAvatarSchema = ApiMeSchema.pick({ avatarUrl: true });

export type ApiMeAvatarDTO = z.infer<typeof ApiMeAvatarSchema>;
