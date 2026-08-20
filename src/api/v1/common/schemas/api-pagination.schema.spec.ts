import { ApiPageQuerySchema } from './api-pagination.schema';

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

  it('caps limit so one call cannot ask for the whole table', () => {
    expect(ApiPageQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('refuses a page below one', () => {
    expect(ApiPageQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });

  it('refuses an unknown query parameter', () => {
    expect(ApiPageQuerySchema.safeParse({ sort: 'score' }).success).toBe(false);
  });
});
