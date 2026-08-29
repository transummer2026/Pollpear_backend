import { z } from 'zod';
import { VoteSchema as VoteModel } from 'Pollpear_shared/src/prisma/schemas/models/Vote.schema';
import { MAX_LABEL, MAX_OPTIONS } from './api-polls.schema';

export const ApiVoteColumnsSchema = VoteModel.pick({
  id: true,
  pollId: true,
  freeField: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  freeField: z.string().nullable(),
});

export const ApiVoteSchema = ApiVoteColumnsSchema.extend({
  optionIds: z.array(z.number().int()),
});

const optionId = () => z.number().int().min(1);

export const ApiVoteCastSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('single_choice'),
    optionIds: z.array(optionId()).length(1),
  }),
  z.strictObject({
    type: z.literal('multiple_choice'),
    optionIds: z.array(optionId()).min(1).max(MAX_OPTIONS),
  }),
  z.strictObject({
    type: z.literal('slider'),
    optionIds: z.array(optionId()).length(1),
    freeField: z.string().min(1).max(MAX_LABEL),
  }),
]);

export type ApiVoteColumnsDTO = z.infer<typeof ApiVoteColumnsSchema>;
export type ApiVoteDTO = z.infer<typeof ApiVoteSchema>;
export type ApiVoteCastDTO = z.infer<typeof ApiVoteCastSchema>;
