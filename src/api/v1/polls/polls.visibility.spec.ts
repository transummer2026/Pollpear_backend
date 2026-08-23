import { visibleTo, matching, authorOf } from './polls.visibility';
import { viewerAs } from '../common/viewer.mock';

const stranger = viewerAs(7, 'user');
const moderator = viewerAs(2, 'moderator');
const admin = viewerAs(1, 'admin');

describe('visibleTo', () => {
  it('offers a plain caller three ways in, and no fourth', () => {
    const where = visibleTo(stranger);

    expect(where.deletedAt).toBeNull();
    expect(where.type).toEqual({
      in: ['single_choice', 'multiple_choice', 'slider'],
    });
    expect(where.OR).toEqual([
      { visibility: 'public' },
      { createdById: 7 },
      {
        room: {
          deletedAt: null,
          roomMembers: { some: { userId: 7, deletedAt: null } },
        },
      },
    ]);
  });

  it('lists a public poll whatever its state: pending is not a draft', () => {
    const [publicPolls] = visibleTo(stranger).OR ?? [];

    expect(publicPolls).toEqual({ visibility: 'public' });
  });

  it('drops the restriction for a moderator, but not the deleted ones', () => {
    const where = visibleTo(moderator);

    expect(where.OR).toBeUndefined();
    expect(where.deletedAt).toBeNull();
  });

  it('keeps a type the api does not offer out, whatever the role', () => {
    for (const viewer of [stranger, moderator, admin]) {
      expect(visibleTo(viewer).type).toEqual({
        in: ['single_choice', 'multiple_choice', 'slider'],
      });
    }
  });

  it('shows an admin everything, deleted included', () => {
    const where = visibleTo(admin);

    expect(where.OR).toBeUndefined();
    expect(where.deletedAt).toBeUndefined();
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
