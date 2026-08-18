// src/api/v1/common/schemas/api-me.schema.ts
import { z } from 'zod';
import {
  Gender,
  UserRole,
  UserTheme,
  Visibility,
} from 'src/generated/prisma/enums';

/**
 * Enums come from the prisma schema so the two cannot silently disagree.
 * What keeps that from widening the contract behind our back is
 * api-me.schema.spec, which pins the exact values this api promises: adding
 * one upstream breaks the build, not a consumer.
 */
export const ApiMeSchema = z.object({
  username: z.string(),
  name: z.string().nullable(),
  surname: z.string().nullable(),
  email: z.string(),
  birthdate: z.date(),
  role: z.enum(UserRole),
  gender: z.enum(Gender),
  nationality: z.string(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  company: z.string().nullable(),
  bio: z.string().nullable(),
  score: z.number().int(),
  isOnline: z.boolean(),
  isEmailVerified: z.boolean(),
  visibility: z.enum(Visibility),
  lastSeenAt: z.date().nullable(),
  avatarUrl: z.url().nullable(),
  bannerUrl: z.url().nullable(),
  userTheme: z.enum(UserTheme),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ApiMeDTO = z.infer<typeof ApiMeSchema>;

const EditableText = z.string().max(255).nullable();

export const ApiMeUpdateSchema = z
  .strictObject({
    name: EditableText,
    surname: EditableText,
    bio: EditableText,
    city: EditableText,
    state: EditableText,
    country: EditableText,
    company: EditableText,
    gender: ApiMeSchema.shape.gender,
    visibility: ApiMeSchema.shape.visibility,
    userTheme: ApiMeSchema.shape.userTheme,
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: 'Send at least one field to update',
  });

export type ApiMeUpdateDTO = z.infer<typeof ApiMeUpdateSchema>;

export const ApiMeAvatarSchema = z.object({
  avatarUrl: z.url(),
});

export type ApiMeAvatarDTO = z.infer<typeof ApiMeAvatarSchema>;
