import { ApiPollOfferedTypeSchema } from './api-polls.schema';
import { ApiVoteCastSchema, ApiVoteChangeSchema } from './api-votes.schema';

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
        freeField: 7,
      }).success,
    ).toBe(true);
  });

  it('refuses a freeField on a ballot that is not a slider', () => {
    const parsed = ApiVoteCastSchema.safeParse({
      type: 'single_choice',
      optionIds: [1],
      freeField: 7,
    });

    expect(parsed.success).toBe(false);
  });
});

describe('ApiVoteChangeSchema', () => {
  it('takes a ballot that only carries the slider value', () => {
    expect(
      ApiVoteChangeSchema.safeParse({ type: 'slider', freeField: 8 }).success,
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
  const cast = (freeField: unknown) =>
    ApiVoteCastSchema.safeParse({ type: 'slider', optionIds: [1], freeField })
      .success;

  it('takes a number, whole or fractional', () => {
    expect(cast(7)).toBe(true);
    expect(cast(3.5)).toBe(true);
    expect(cast(0)).toBe(true);
  });

  it('refuses anything a slider could not have produced', () => {
    expect(cast('banane')).toBe(false);
    expect(cast('7')).toBe(false);
    expect(cast(null)).toBe(false);
    expect(cast('')).toBe(false);
    expect(cast(true)).toBe(false);
  });

  it('refuses a value no arithmetic survives', () => {
    expect(cast(Number.NaN)).toBe(false);
    expect(cast(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
