import { matching, parties } from './friendships.presentation';
import type { ApiFriendshipQueryDTO } from '../common/schemas/api-friendships.schema';

const page: ApiFriendshipQueryDTO = { page: 1, limit: 20 };

const anna = { id: 4, username: 'anna' };
const bob = { id: 9, username: 'bob' };

describe('matching', () => {
  it('asks for nothing when the query carries no filter', () => {
    expect(matching(page)).toEqual({});
  });

  it('reads a status filter as the column that holds it', () => {
    expect(matching({ ...page, status: 'pending' })).toEqual({
      status: 'pending',
    });
  });

  it('looks for the account on either side of the stored pair', () => {
    expect(matching({ ...page, with: 9 })).toEqual({
      OR: [{ userAId: 9 }, { userBId: 9 }],
    });
  });

  it('combines every filter it is given', () => {
    expect(matching({ ...page, status: 'accepted', with: 9 })).toEqual({
      status: 'accepted',
      OR: [{ userAId: 9 }, { userBId: 9 }],
    });
  });
});

describe('parties', () => {
  it('names the addressee whichever side of the pair they sit on', () => {
    expect(parties({ addresseeId: 9, userA: anna, userB: bob })).toEqual({
      requester: anna,
      addressee: bob,
    });

    expect(parties({ addresseeId: 4, userA: anna, userB: bob })).toEqual({
      requester: bob,
      addressee: anna,
    });
  });

  it('never lets the stored order decide who asked', () => {
    const sameFriendship = { userA: anna, userB: bob };

    expect(parties({ ...sameFriendship, addresseeId: 4 }).requester).toEqual(
      bob,
    );
    expect(parties({ ...sameFriendship, addresseeId: 9 }).requester).toEqual(
      anna,
    );
  });
});
