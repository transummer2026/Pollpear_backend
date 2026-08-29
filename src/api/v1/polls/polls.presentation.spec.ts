import { matching, authorOf } from './polls.presentation';
import { accessibleBy, type AppAbility } from 'src/casl/casl-prisma';
import { viewerAs } from '../common/viewer.mock';

const stranger = viewerAs(7, 'user');
const moderator = viewerAs(2, 'moderator');
const admin = viewerAs(1, 'admin');

describe('the poll read scope, straight from the policy', () => {
  const scopeFor = (viewer: { ability: AppAbility }) =>
    accessibleBy(viewer.ability, 'read').ofType('Poll');

  it('offers a plain caller three ways in, and no fourth', () => {
    expect(scopeFor(stranger).OR).toEqual([
      {
        deletedAt: null,
        visibility: 'public',
        createdBy: {
          is: {
            blocksGiven: { none: { blockedId: 7 } },
            blocksReceived: { none: { blockerId: 7 } },
          },
        },
      },
      { deletedAt: null, visibility: 'private', createdById: 7 },
      {
        deletedAt: null,
        room: { is: { roomMembers: { some: { userId: 7, deletedAt: null } } } },
      },
    ]);
  });

  it('lists a public poll whatever its state: pending is not a draft', () => {
    const [publicPolls] = scopeFor(stranger).OR ?? [];

    expect(publicPolls).toEqual({
      deletedAt: null,
      visibility: 'public',
      createdBy: {
        is: {
          blocksGiven: { none: { blockedId: 7 } },
          blocksReceived: { none: { blockerId: 7 } },
        },
      },
    });
  });

  it('widens a moderator to every poll, but not the deleted ones', () => {
    expect(scopeFor(moderator).OR).toContainEqual({ deletedAt: null });
  });

  it('leaves an admin unrestricted, deleted included', () => {
    expect(scopeFor(admin)).toEqual({});
  });
});

describe('matching', () => {
  const page = { page: 1, limit: 20 };

  it('adds nothing when no filter is given', () => {
    expect(matching(page)).toEqual({});
  });

  it('translates every filter the route accepts', () => {
    expect(
      matching({
        ...page,
        type: 'slider',
        status: 'active',
        createdBy: 9,
        hashtag: 'climate',
      }),
    ).toEqual({
      type: 'slider',
      status: 'active',
      createdById: 9,
      pollHashtags: {
        some: { hashtag: { name: 'climate', deletedAt: null } },
      },
    });
  });

  it('never matches a hashtag that was deleted', () => {
    expect(matching({ ...page, hashtag: 'gone' }).pollHashtags).toEqual({
      some: { hashtag: { name: 'gone', deletedAt: null } },
    });
  });
});

describe('authorOf', () => {
  const author = { id: 7, username: 'pollpear' };

  it('names the author of a signed poll', () => {
    expect(authorOf({ isAnonymous: false, createdBy: author }, moderator)).toBe(
      author,
    );
  });

  it('hides the author of an anonymous poll', () => {
    expect(
      authorOf(
        { isAnonymous: true, createdBy: author },
        { ...stranger, id: 8 },
      ),
    ).toBeNull();
  });

  it('still tells you that an anonymous poll is yours', () => {
    expect(authorOf({ isAnonymous: true, createdBy: author }, stranger)).toBe(
      author,
    );
  });

  it('lets a moderator see behind an anonymous poll', () => {
    expect(authorOf({ isAnonymous: true, createdBy: author }, moderator)).toBe(
      author,
    );
  });
});
