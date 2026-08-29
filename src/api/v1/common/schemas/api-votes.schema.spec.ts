import { ApiPollOfferedTypeSchema } from './api-polls.schema';
import { ApiVoteCastSchema } from './api-votes.schema';

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
