import { presentUser, stateOf, VIEWER_SELECT } from './users.visibility';

const noBlock = { blocksReceived: [] };
const blocked = { blocksReceived: [{ id: 1 }] };

describe('VIEWER_SELECT', () => {
  it('only ever looks at the blocks the caller placed themselves', () => {
    expect(VIEWER_SELECT(7).blocksReceived.where).toEqual({ blockerId: 7 });
  });

  /**
   * The policy already keeps deleted and private accounts out of the answer,
   * so no column is read to second-guess it here.
   */
  it('reads nothing beyond that', () => {
    expect(Object.keys(VIEWER_SELECT(7))).toEqual(['blocksReceived']);
  });
});

describe('stateOf', () => {
  it('flags an account the caller blocked', () => {
    expect(stateOf(blocked)).toBe('blocked');
  });

  it('says nothing about an ordinary account', () => {
    expect(stateOf(noBlock)).toBeUndefined();
  });
});

describe('presentUser', () => {
  const row = { id: 9, username: 'zoe', avatarUrl: null, score: 3 };

  it('drops the column read only to decide the state', () => {
    const shown = presentUser({ ...row, ...blocked });

    expect(shown).not.toHaveProperty('blocksReceived');
    expect(shown.username).toBe('zoe');
  });

  it('answers the same state as stateOf, so both routes agree', () => {
    expect(presentUser({ ...row, ...blocked }).state).toBe('blocked');
    expect(presentUser({ ...row, ...noBlock }).state).toBeUndefined();
  });

  it('never lets a storage path through as an avatar', () => {
    const shown = presentUser({
      ...row,
      ...noBlock,
      avatarUrl: '/uploads/avatars/9.webp',
    });

    expect(shown.avatarUrl).toBeNull();
  });
});
