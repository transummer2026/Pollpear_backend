import {
  ApiFriendshipColumnsSchema,
  ApiFriendshipCreateSchema,
  ApiFriendshipQuerySchema,
  ApiFriendshipSchema,
  ApiFriendshipUpdateSchema,
} from './api-friendships.schema';
import { LIMIT_BY_ROLE } from './api-pagination.schema';

describe('ApiFriendshipCreateSchema', () => {
  it('takes the account being asked, and nothing else', () => {
    expect(
      ApiFriendshipCreateSchema.safeParse({ addresseeId: 9 }).success,
    ).toBe(true);
  });

  it('refuses a field nobody declared', () => {
    expect(
      ApiFriendshipCreateSchema.safeParse({
        addresseeId: 9,
        status: 'accepted',
      }).success,
    ).toBe(false);
  });

  it('never lets the body name the requester', () => {
    for (const field of ['userAId', 'userBId', 'requesterId']) {
      expect(
        ApiFriendshipCreateSchema.safeParse({ addresseeId: 9, [field]: 1 })
          .success,
      ).toBe(false);
    }
  });

  it('refuses an id that can designate no account', () => {
    expect(
      ApiFriendshipCreateSchema.safeParse({ addresseeId: 0 }).success,
    ).toBe(false);
    expect(ApiFriendshipCreateSchema.safeParse({}).success).toBe(false);
  });
});

describe('ApiFriendshipUpdateSchema', () => {
  it.each(['accepted', 'rejected'])('answers %s', (status) => {
    expect(ApiFriendshipUpdateSchema.safeParse({ status }).success).toBe(true);
  });

  it('refuses a return to pending, which the policy does not allow either', () => {
    expect(
      ApiFriendshipUpdateSchema.safeParse({ status: 'pending' }).success,
    ).toBe(false);
  });

  it('refuses an empty body and an unknown field', () => {
    expect(ApiFriendshipUpdateSchema.safeParse({}).success).toBe(false);
    expect(
      ApiFriendshipUpdateSchema.safeParse({
        status: 'accepted',
        addresseeId: 3,
      }).success,
    ).toBe(false);
  });
});

describe('ApiFriendshipQuerySchema', () => {
  it('pages from 1 when the query says nothing', () => {
    expect(ApiFriendshipQuerySchema.parse({})).toMatchObject({
      page: 1,
      limit: 20,
    });
  });

  it('reads the filters as the types the columns hold', () => {
    expect(
      ApiFriendshipQuerySchema.parse({ with: '9', status: 'pending' }),
    ).toMatchObject({ with: 9, status: 'pending' });
  });

  it('refuses a parameter nobody declared', () => {
    expect(ApiFriendshipQuerySchema.safeParse({ sort: 'id' }).success).toBe(
      false,
    );
  });

  it('refuses a limit past the highest ceiling', () => {
    expect(
      ApiFriendshipQuerySchema.safeParse({ limit: LIMIT_BY_ROLE.admin + 1 })
        .success,
    ).toBe(false);
  });
});

describe('the payload', () => {
  it('never carries the stored pair, whose order means nothing', () => {
    const keys = Object.keys(ApiFriendshipSchema.shape);

    for (const hidden of ['userAId', 'userBId', 'addresseeId', 'deletedAt']) {
      expect(keys).not.toContain(hidden);
    }
  });

  it('names the two parties by their role instead', () => {
    expect(Object.keys(ApiFriendshipSchema.shape)).toEqual(
      expect.arrayContaining(['requester', 'addressee']),
    );
  });

  it('carries no column the policy reads but the caller must not see', () => {
    expect(Object.keys(ApiFriendshipColumnsSchema.shape)).not.toContain(
      'deletedAt',
    );
  });
});
