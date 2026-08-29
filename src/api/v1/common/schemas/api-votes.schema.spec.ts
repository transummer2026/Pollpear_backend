import { ApiPollOfferedTypeSchema } from './api-polls.schema';
import {
  ApiVoteCastSchema,
  ApiVoteChangeSchema,
  MAX_FREE_FIELD,
} from './api-votes.schema';
import { declaredLength } from './prisma-column.mock';

describe('ApiVoteCastSchema', () => {
  const ballotTypes = ApiVoteCastSchema.options.map(
    (ballot) => ballot.shape.type.value,
  );

  it('answers exactly the poll types the api offers', () => {
    expect([...ballotTypes].sort()).toEqual(
      [...ApiPollOfferedTypeSchema.options].sort(),
    );
  });

  it('refuses a ballot for a type no poll can have', () => {
    const parsed = ApiVoteCastSchema.safeParse({
      type: 'free_field',
      optionIds: [1],
    });

    expect(parsed.success).toBe(false);
  });

  it('asks a slider ballot for the value it carries', () => {
    expect(
      ApiVoteCastSchema.safeParse({ type: 'slider', optionIds: [1] }).success,
    ).toBe(false);
    expect(
      ApiVoteCastSchema.safeParse({
        type: 'slider',
        optionIds: [1],
        freeField: '7',
      }).success,
    ).toBe(true);
  });

  it('refuses a freeField on a ballot that is not a slider', () => {
    const parsed = ApiVoteCastSchema.safeParse({
      type: 'single_choice',
      optionIds: [1],
      freeField: '7',
    });

    expect(parsed.success).toBe(false);
  });
});

describe('ApiVoteChangeSchema', () => {
  it('takes a ballot that only carries the slider value', () => {
    expect(
      ApiVoteChangeSchema.safeParse({ type: 'slider', freeField: '8' }).success,
    ).toBe(true);
  });

  it('takes a ballot that only carries a new selection', () => {
    expect(
      ApiVoteChangeSchema.safeParse({
        type: 'single_choice',
        optionIds: [1],
      }).success,
    ).toBe(true);
  });

  it('refuses a ballot that changes nothing', () => {
    expect(
      ApiVoteChangeSchema.safeParse({ type: 'single_choice' }).success,
    ).toBe(false);
  });

  it('still refuses a selection the poll type cannot hold', () => {
    expect(
      ApiVoteChangeSchema.safeParse({
        type: 'single_choice',
        optionIds: [1, 2],
      }).success,
    ).toBe(false);
  });
});

describe('The slider value', () => {
  it('is bounded by the column that stores it, not by an option label', () => {
    expect(declaredLength('Vote', 'freeField')).toBe(MAX_FREE_FIELD);
  });

  it('takes the longest value the column holds, and refuses one more', () => {
    const at = (length: number) =>
      ApiVoteCastSchema.safeParse({
        type: 'slider',
        optionIds: [1],
        freeField: 'x'.repeat(length),
      }).success;

    expect(at(MAX_FREE_FIELD)).toBe(true);
    expect(at(MAX_FREE_FIELD + 1)).toBe(false);
  });
});
