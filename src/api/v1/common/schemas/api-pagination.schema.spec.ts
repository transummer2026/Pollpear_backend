import { ApiPageQuerySchema, LIMIT_BY_ROLE } from './api-pagination.schema';

describe('ApiPageQuerySchema', () => {
  it('defaults to the first page', () => {
    expect(ApiPageQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it('coerces the strings a query string carries', () => {
    expect(ApiPageQuerySchema.parse({ page: '3', limit: '50' })).toEqual({
      page: 3,
      limit: 50,
    });
  });

  it('caps limit at the highest ceiling any role can reach', () => {
    const highest = String(LIMIT_BY_ROLE.admin);

    expect(ApiPageQuerySchema.safeParse({ limit: highest }).success).toBe(true);
    expect(
      ApiPageQuerySchema.safeParse({ limit: String(LIMIT_BY_ROLE.admin + 1) })
        .success,
    ).toBe(false);
  });

  it('leaves the per role ceiling to the service, which knows the caller', () => {
    expect(ApiPageQuerySchema.safeParse({ limit: '101' }).success).toBe(true);
  });

  it('refuses a page below one', () => {
    expect(ApiPageQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });

  it('refuses an unknown query parameter', () => {
    expect(ApiPageQuerySchema.safeParse({ sort: 'score' }).success).toBe(false);
  });
});
