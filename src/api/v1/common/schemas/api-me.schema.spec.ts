import { ApiMeSchema, ApiMeUpdateSchema } from './api-me.schema';

/**
 * The schema reads its enums from prisma, which removes the risk of writing
 * a stale copy by hand. These tests carry the other half of the deal: they
 * pin what the public api promises, so widening an enum upstream fails in
 * CI and stays a decision, instead of reaching consumers unannounced.
 */
describe('ApiMeSchema enums', () => {
  it('exposes exactly three roles', () => {
    expect(ApiMeSchema.shape.role.options).toEqual([
      'user',
      'moderator',
      'admin',
    ]);
  });

  it('exposes exactly four genders', () => {
    expect(ApiMeSchema.shape.gender.options).toEqual([
      'male',
      'female',
      'other',
      'prefer_not_to_say',
    ]);
  });

  it('exposes exactly two visibilities', () => {
    expect(ApiMeSchema.shape.visibility.options).toEqual(['public', 'private']);
  });

  it('exposes exactly four themes', () => {
    expect(ApiMeSchema.shape.userTheme.options).toEqual([
      'light',
      'dark',
      'system',
      'other',
    ]);
  });
});

describe('ApiMeSchema media', () => {
  it('refuses a relative path, which no third party can resolve', () => {
    const media = ApiMeSchema.shape.avatarUrl;

    expect(media.safeParse('/uploads/avatars/default.svg').success).toBe(false);
    expect(media.safeParse('https://cdn.pollpear.com/a.webp').success).toBe(
      true,
    );
    expect(media.safeParse(null).success).toBe(true);
  });
});

describe('ApiMeUpdateSchema', () => {
  it('accepts only the enum values the contract exposes', () => {
    expect(ApiMeUpdateSchema.safeParse({ visibility: 'private' }).success).toBe(
      true,
    );
    expect(ApiMeUpdateSchema.safeParse({ visibility: 'secret' }).success).toBe(
      false,
    );
  });
});
