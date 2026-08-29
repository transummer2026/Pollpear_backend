import type { Prisma } from 'src/generated/prisma/client';
import { selectOf } from '../../common/select';
import {
  ApiVoteColumnsSchema,
  ApiVoteSchema,
  type ApiVoteDTO,
} from '../../common/schemas/api-votes.schema';

export const VOTE_SELECT = {
  ...selectOf(ApiVoteColumnsSchema),
  voteOptions: { select: { optionId: true } },
} satisfies Prisma.VoteSelect;

type StoredVote = Prisma.VoteGetPayload<{ select: typeof VOTE_SELECT }>;

export function presentVote(vote: StoredVote): ApiVoteDTO {
  const { voteOptions, ...columns } = vote;

  return ApiVoteSchema.parse({
    ...columns,
    optionIds: voteOptions.map((voted) => voted.optionId),
  });
}
