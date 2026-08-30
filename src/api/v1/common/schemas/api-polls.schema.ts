import { z } from 'zod';
import { PollSchema as PollModel } from 'Pollpear_shared/src/prisma/schemas/models/Poll.schema';
import { UserSchema as UserModel } from 'Pollpear_shared/src/prisma/schemas/models/User.schema';
import { OptionSchema as OptionModel } from 'Pollpear_shared/src/prisma/schemas/models/Option.schema';
import { PollStatus, PollType, Visibility } from 'src/generated/prisma/enums';
import { apiPageOf, ApiPageQuerySchema } from './api-pagination.schema';
import { endsInTheFuture } from './api-dates.schema';

export const MAX_OPTIONS = 20;
export const MAX_TITLE = 255;
export const MAX_LABEL = 255;
export const MAX_DESCRIPTION = 3000;

const OPTIONS_PER_TYPE = {
  single_choice: { min: 2, max: MAX_OPTIONS },
  multiple_choice: { min: 2, max: MAX_OPTIONS },
  slider: { min: 1, max: 1 },
  free_field: null,
} satisfies Record<PollType, { min: number; max: number } | null>;

const OFFERED_TYPES = (Object.keys(OPTIONS_PER_TYPE) as PollType[]).filter(
  (type) => OPTIONS_PER_TYPE[type] !== null,
);

export const ApiPollOfferedTypeSchema = z.enum(
  OFFERED_TYPES as [PollType, ...PollType[]],
);

export const ApiPollAuthorSchema = UserModel.pick({
  id: true,
  username: true,
});

export const ApiPollListColumnsSchema = PollModel.pick({
  id: true,
  title: true,
  type: true,
  status: true,
  endsAt: true,
}).extend({
  type: ApiPollOfferedTypeSchema,
  status: z.enum(PollStatus),
});

const ApiPollListItemSchema = ApiPollListColumnsSchema.extend({
  createdBy: ApiPollAuthorSchema.nullable(),
  voterCount: z.number().int(),
});

export const ApiPollPageSchema = apiPageOf(ApiPollListItemSchema);

export const ApiPollColumnsSchema = PollModel.pick({
  id: true,
  title: true,
  description: true,
  type: true,
  visibility: true,
  allowChangeVote: true,
  isAnonymous: true,
  status: true,
  publishedAt: true,
  endsAt: true,
  createdAt: true,
  updatedAt: true,
  roomId: true,
}).extend({
  description: z.string().nullable(),
  publishedAt: z.date().nullable(),
  roomId: z.number().int().nullable(),
  type: ApiPollOfferedTypeSchema,
  status: z.enum(PollStatus),
  visibility: z.enum(Visibility),
});

export const ApiPollOptionSchema = OptionModel.pick({
  id: true,
  text: true,
  order: true,
  sliderLeftLabel: true,
  sliderRightLabel: true,
}).extend({
  sliderLeftLabel: z.string().nullable(),
  sliderRightLabel: z.string().nullable(),
});

export const ApiPollSchema = ApiPollColumnsSchema.extend({
  createdBy: ApiPollAuthorSchema.nullable(),
  options: z.array(ApiPollOptionSchema),
  voterCount: z.number().int(),
});

const OptionInput = z.strictObject({
  text: z.string().min(1).max(MAX_LABEL),
  order: z.number().int().min(0),
  sliderLeftLabel: z.string().max(MAX_LABEL).nullable().optional(),
  sliderRightLabel: z.string().max(MAX_LABEL).nullable().optional(),
});

export const ApiPollCreateSchema = z
  .strictObject({
    title: z.string().min(1).max(MAX_TITLE),
    description: z.string().max(MAX_DESCRIPTION).nullable().optional(),
    type: ApiPollOfferedTypeSchema,
    visibility: z.enum(Visibility),
    allowChangeVote: z.boolean(),
    isAnonymous: z.boolean(),
    endsAt: endsInTheFuture(),
    roomId: z.number().int().min(1).nullable().optional(),
    options: z.array(OptionInput).default([]),
  })
  .superRefine((body, ctx) => {
    const bounds = OPTIONS_PER_TYPE[body.type];
    if (bounds === null) {
      return;
    }
    const { min, max } = bounds;
    if (body.options.length < min || body.options.length > max) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: `a ${body.type} poll takes ${min === max ? min : `${min} to ${max}`} options`,
      });
    }

    const orders = new Set(body.options.map((option) => option.order));
    if (orders.size !== body.options.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'two options cannot share the same order',
      });
    }
  });

export const ApiPollUpdateSchema = z
  .strictObject({
    title: z.string().min(1).max(MAX_TITLE),
    description: z.string().max(MAX_DESCRIPTION).nullable(),
    visibility: z.enum(Visibility),
    endsAt: endsInTheFuture(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: 'Send at least one field to update',
  });

export const ApiPollFilterSchema = z.object({
  type: ApiPollOfferedTypeSchema.optional(),
  status: z.enum(PollStatus).optional(),
  createdBy: z.coerce.number().int().min(1).optional(),
  hashtag: z.string().min(1).max(MAX_LABEL).optional(),
});

export const ApiPollQuerySchema = ApiPageQuerySchema.extend(
  ApiPollFilterSchema.shape,
);

export const MAX_DISTRIBUTION = 100;

const ApiPollOptionResultSchema = z.object({
  optionId: z.number().int(),
  text: z.string(),
  voters: z.number().int(),
});

const ApiPollChoiceResultsSchema = z.object({
  type: z.enum(['single_choice', 'multiple_choice']),
  voters: z.number().int(),
  options: z.array(ApiPollOptionResultSchema),
});

const ApiPollAnswerCountSchema = z.object({
  value: z.string(),
  voters: z.number().int(),
});

const ApiPollSliderResultsSchema = z.object({
  type: z.literal('slider'),
  voters: z.number().int(),
  average: z.number().nullable(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  truncated: z.boolean(),
  distribution: z.array(ApiPollAnswerCountSchema),
});

export const ApiPollResultsSchema = z.union([
  ApiPollChoiceResultsSchema,
  ApiPollSliderResultsSchema,
]);

export { ApiPollChoiceResultsSchema, ApiPollSliderResultsSchema };

export type ApiPollListColumnsDTO = z.infer<typeof ApiPollListColumnsSchema>;
export type ApiPollPageDTO = z.infer<typeof ApiPollPageSchema>;
export type ApiPollColumnsDTO = z.infer<typeof ApiPollColumnsSchema>;
export type ApiPollDTO = z.infer<typeof ApiPollSchema>;
export type ApiPollCreateDTO = z.infer<typeof ApiPollCreateSchema>;
export type ApiPollUpdateDTO = z.infer<typeof ApiPollUpdateSchema>;
export type ApiPollFilterDTO = z.infer<typeof ApiPollFilterSchema>;
export type ApiPollQueryDTO = z.infer<typeof ApiPollQuerySchema>;
export type ApiPollOptionDTO = z.infer<typeof ApiPollOptionSchema>;
export type ApiPollAuthorDTO = z.infer<typeof ApiPollAuthorSchema>;
export type ApiPollResultsDTO = z.infer<typeof ApiPollResultsSchema>;
