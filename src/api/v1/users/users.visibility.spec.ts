import { visibleTo, stateOf, presentUser } from './users.visibility';
import { viewerAs } from '../common/viewer.mock';

const stranger = viewerAs(1, 'user');
const moderator = viewerAs(2, 'moderator');
const admin = viewerAs(3, 'admin');

const noRows = { deletedAt: null, bansReceived: [], blocksReceived: [] };
const banned = { ...noRows, bansReceived: [{ id: 1 }] };
const blocked = { ...noRows, blocksReceived: [{ id: 1 }] };
const deleted = { ...noRows, deletedAt: new Date('2026-01-01') };

describe('visibleTo', () => {
  it('hides deleted and banned accounts from an ordinary caller', () => {
    expect(visibleTo(stranger)).toEqual({
      visibility: 'public',
      deletedAt: null,
      bansReceived: {
        none: { endedAt: { gt: expect.any(Date) as Date }, unbannedById: null },
      },
    });
  });

  it('lists an account whose ban a moderator lifted early', () => {
    const where = visibleTo(stranger);

    expect(where.bansReceived).toEqual({
      none: expect.objectContaining({ unbannedById: null }) as object,
    });
  });

  it('shows banned accounts to a moderator, still not the deleted ones', () => {
    const where = visibleTo(moderator);

    expect(where.bansReceived).toBeUndefined();
    expect(where.deletedAt).toBeNull();
  });

  it('shows everything to an admin', () => {
    const where = visibleTo(admin);

    expect(where.bansReceived).toBeUndefined();
    expect(where.deletedAt).toBeUndefined();
  });

  it('lists opted in accounts by name, never as "not private"', () => {
    expect(visibleTo(stranger).visibility).toBe('public');
  });

  it('never filters on blocks, whatever the role', () => {
    for (const where of [visibleTo(stranger), visibleTo(admin)]) {
      expect(where).not.toHaveProperty('blocksReceived');
      expect(where).not.toHaveProperty('blocksGiven');
    }
  });
});

describe('stateOf', () => {
  it('reports nothing for a plain account', () => {
    expect(stateOf(noRows, admin)).toBeUndefined();
  });

  it('flags the accounts the caller blocked, at any role', () => {
    expect(stateOf(blocked, stranger)).toBe('blocked');
    expect(stateOf(blocked, admin)).toBe('blocked');
  });

  it('reports banned only to someone who may see it', () => {
    expect(stateOf(banned, stranger)).toBeUndefined();
    expect(stateOf(banned, moderator)).toBe('banned');
  });

  it('reports deleted only to an admin', () => {
    expect(stateOf(deleted, moderator)).toBeUndefined();
    expect(stateOf(deleted, admin)).toBe('deleted');
  });

  it('puts deleted before banned before blocked', () => {
    const everything = {
      deletedAt: new Date('2026-01-01'),
      bansReceived: [{ id: 1 }],
      blocksReceived: [{ id: 1 }],
    };

    expect(stateOf(everything, admin)).toBe('deleted');
    expect(stateOf(everything, moderator)).toBe('banned');
    expect(stateOf(everything, stranger)).toBe('blocked');
  });
});

describe('presentUser', () => {
  const row = { ...noRows, id: 7, username: 'pollpear', avatarUrl: null };

  it('drops the columns read only to decide the state', () => {
    const shown = presentUser(row, stranger);

    for (const column of ['deletedAt', 'bansReceived', 'blocksReceived']) {
      expect(shown).not.toHaveProperty(column);
    }
    expect(shown).toMatchObject({ id: 7, username: 'pollpear' });
  });

  it('answers the same state as stateOf, so both routes agree', () => {
    expect(presentUser({ ...row, ...banned }, moderator).state).toBe('banned');
    expect(presentUser({ ...row, ...banned }, stranger).state).toBeUndefined();
  });

  it('hands out a media path only when it is a public url', () => {
    expect(
      presentUser({ ...row, avatarUrl: '/uploads/avatars/7.webp' }, stranger)
        .avatarUrl,
    ).toBeNull();
    expect(
      presentUser(
        { ...row, avatarUrl: 'https://cdn.pollpear.com/7.webp' },
        stranger,
      ).avatarUrl,
    ).toBe('https://cdn.pollpear.com/7.webp');
  });
});
