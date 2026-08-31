import { presentVote, VOTE_SELECT } from './vote.presentation';
import { ApiVoteColumnsSchema } from '../../common/schemas/api-votes.schema';

const stored = {
  id: 5,
  pollId: 42,
  freeField: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  voteOptions: [{ optionId: 3 }, { optionId: 9 }],
};

describe('presentVote', () => {
  it('turns the joined rows into plain option ids', () => {
    expect(presentVote(stored).optionIds).toEqual([3, 9]);
  });

  it('never leaks the join itself', () => {
    expect(presentVote(stored)).not.toHaveProperty('voteOptions');
  });

  it('reads exactly the columns the payload promises, and the join', () => {
    expect(Object.keys(VOTE_SELECT).sort()).toEqual(
      [...Object.keys(ApiVoteColumnsSchema.shape), 'voteOptions'].sort(),
    );
  });
});
