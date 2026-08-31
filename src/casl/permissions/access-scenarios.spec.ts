import { subject } from '@casl/ability';
import type { Poll, Room, Vote } from 'src/generated/prisma/client';
import { CaslAbilityFactory } from '../casl-ability.factory';

/**
 * End-to-end-ish authorization battery, told as scenarios rather than
 * per-rule unit tests. It nails down the two things that kept breaking:
 *
 *  1. A poll created *outside* a room is public — anyone (not blocked by the
 *     author) may read and vote. A poll created *inside* a room belongs to
 *     the room: it is reachable only with the room's own rights (active
 *     membership) on top of the poll rights. Leaving or being kicked from the
 *     room takes read + vote (create *and* edit/delete) with it.
 *
 *  2. The invitation lifecycle: invite → accept (joins) → leave / kick
 *     (drops membership *and* revokes the accepted invitation) → re-invite
 *     (fresh pending) → accept again (re-joins).
 */

const ME = 1;
const OTHER = 2;
const OWNER = 3;

function ability(id = ME, role: 'user' | 'moderator' | 'admin' = 'user') {
  return new CaslAbilityFactory().createForUser({ id, role });
}

// ---- subject builders (shapes mirror what the services actually load) ----

const notBlocked = {
  blocksGiven: [] as unknown[],
  blocksReceived: [] as unknown[],
};

function standalonePoll(over: Partial<Poll> & Record<string, unknown> = {}) {
  return subject('Poll', {
    deletedAt: null,
    status: 'active',
    roomId: null,
    room: null,
    visibility: 'public',
    createdById: OTHER,
    createdBy: notBlocked,
    ...over,
  } as unknown as Poll);
}

/** A poll filed in a room. `memberIds` are the room's *active* members. */
function roomPoll(
  memberIds: number[],
  over: Partial<Poll> & Record<string, unknown> = {},
  roomOver: Record<string, unknown> = {},
) {
  return subject('Poll', {
    deletedAt: null,
    status: 'active',
    roomId: 7,
    visibility: 'private',
    createdById: over.createdById ?? ME,
    createdBy: notBlocked,
    room: {
      id: 7,
      status: 'active',
      deletedAt: null,
      roomMembers: memberIds.map((userId) => ({ userId, deletedAt: null })),
      ...roomOver,
    },
    ...over,
  } as unknown as Poll);
}

function voteOn(
  pollSubject: ReturnType<typeof roomPoll>,
  over: Partial<Vote> & Record<string, unknown> = {},
) {
  return subject('Vote', {
    deletedAt: null,
    createdById: ME,
    poll: pollSubject,
    ...over,
  } as unknown as Vote);
}

function room(over: Partial<Room> & Record<string, unknown> = {}) {
  return subject('Room', {
    id: 7,
    deletedAt: null,
    status: 'active',
    visibility: 'public',
    createdById: OWNER,
    createdBy: { is: notBlocked },
    roomMembers: [{ userId: OWNER, deletedAt: null }],
    invitations: [],
    ...over,
  } as unknown as Room);
}

// =====================================================================
// 1. Standalone poll = public
// =====================================================================

describe('a poll created outside a room is public', () => {
  it('any signed-in user may read and vote on it', () => {
    const a = ability(ME);
    expect(a.can('read', standalonePoll())).toBe(true);
    expect(
      a.can('create', subject('Vote', { poll: standalonePoll() } as never)),
    ).toBe(true);
  });

  it('its own private standalone poll stays visible and votable to its author', () => {
    const mine = standalonePoll({ visibility: 'private', createdById: ME });
    const a = ability(ME);
    expect(a.can('read', mine)).toBe(true);
    expect(a.can('create', subject('Vote', { poll: mine } as never))).toBe(
      true,
    );
  });

  it('a private standalone poll is invisible to everyone else', () => {
    const notMine = standalonePoll({
      visibility: 'private',
      createdById: OTHER,
    });
    expect(ability(ME).can('read', notMine)).toBe(false);
  });

  it('a user blocked by the author can neither read nor vote', () => {
    const blockedByAuthor = standalonePoll({
      createdBy: { blocksGiven: [{ blockedId: ME }], blocksReceived: [] },
    });
    const a = ability(ME);
    expect(a.can('read', blockedByAuthor)).toBe(false);
    expect(
      a.can('create', subject('Vote', { poll: blockedByAuthor } as never)),
    ).toBe(false);
  });
});

// =====================================================================
// 2. Room poll = room rights + poll rights
// =====================================================================

describe('a poll created inside a room belongs to the room', () => {
  describe('an active member', () => {
    const a = ability(ME);

    it('reads it and can cast, change and clear a vote', () => {
      const poll = roomPoll([ME, OWNER]);
      expect(a.can('read', poll)).toBe(true);
      expect(a.can('create', voteOn(poll))).toBe(true);
      expect(a.can('update', voteOn(poll))).toBe(true);
      expect(a.can('delete', voteOn(poll))).toBe(true);
    });

    it('cannot cast or change a vote once the room is closed', () => {
      const poll = roomPoll([ME, OWNER], {}, { status: 'closed' });
      expect(a.can('read', poll)).toBe(true); // a closed room stays readable
      expect(a.can('create', voteOn(poll))).toBe(false);
      expect(a.can('update', voteOn(poll))).toBe(false);
      expect(a.can('delete', voteOn(poll))).toBe(false);
    });

    it('cannot change or clear a vote once the poll itself has closed (room still active)', () => {
      // `create Vote` is gated on *room* status at the CASL layer — the poll's
      // own closure is caught by VotesService#validateVote — but edit/delete
      // carry the `status !== 'closed'` guard directly (deleteVote has no
      // service-level status check).
      const poll = roomPoll([ME, OWNER], { status: 'closed' });
      expect(a.can('update', voteOn(poll))).toBe(false);
      expect(a.can('delete', voteOn(poll))).toBe(false);
    });
  });

  describe('a user who was never a member', () => {
    const a = ability(ME);
    const poll = roomPoll([OWNER, OTHER]);

    it('cannot read it', () => {
      expect(a.can('read', poll)).toBe(false);
    });

    it('cannot vote on it — even as the poll author', () => {
      const authored = roomPoll([OWNER, OTHER], { createdById: ME });
      expect(a.can('read', authored)).toBe(false);
      expect(a.can('create', voteOn(authored))).toBe(false);
    });

    // Making a room poll public must not put it on the feed: a poll filed in
    // a room follows the room's rights, membership is the only way in.
    it('cannot read or vote on it even when the poll is public', () => {
      const publicised = roomPoll([OWNER, OTHER], { visibility: 'public' });
      expect(a.can('read', publicised)).toBe(false);
      expect(a.can('create', voteOn(publicised))).toBe(false);
      expect(a.can('update', voteOn(publicised))).toBe(false);
    });
  });

  describe('a member who leaves (or is kicked)', () => {
    const a = ability(ME);
    // membership row gone -> ME no longer in room.roomMembers
    const poll = roomPoll([OWNER], { createdById: ME });

    it('loses read access to the poll they authored', () => {
      expect(a.can('read', poll)).toBe(false);
    });

    it('cannot cast a new vote', () => {
      expect(a.can('create', voteOn(poll))).toBe(false);
    });

    it('cannot change or clear the vote they cast while a member — the /feed bug', () => {
      expect(a.can('update', voteOn(poll))).toBe(false);
      expect(a.can('delete', voteOn(poll))).toBe(false);
    });
  });

  describe('the room owner', () => {
    const a = ability(OWNER);
    const poll = roomPoll([OWNER]);

    it('reads and votes like any member', () => {
      expect(a.can('read', poll)).toBe(true);
      expect(
        a.can('create', subject('Vote', { createdById: OWNER, poll } as never)),
      ).toBe(true);
    });
  });
});

// =====================================================================
// 3. Filing a poll in a room
// =====================================================================

describe('creating a poll', () => {
  it('is always allowed with no room attached', () => {
    expect(ability(ME).can('create', standalonePoll({ roomId: null }))).toBe(
      true,
    );
  });

  it('is allowed in an active room the caller belongs to', () => {
    expect(ability(ME).can('create', roomPoll([ME]))).toBe(true);
  });

  it('is refused in a room the caller is not a member of', () => {
    expect(ability(ME).can('create', roomPoll([OWNER]))).toBe(false);
  });

  it('is refused once the room is closed, even for a member', () => {
    expect(
      ability(ME).can('create', roomPoll([ME], {}, { status: 'closed' })),
    ).toBe(false);
  });
});

// =====================================================================
// 4. Room read / join / leave
// =====================================================================

describe('reaching a room', () => {
  it('a public active room is readable and joinable by anyone not blocked', () => {
    const a = ability(ME);
    expect(a.can('read', room())).toBe(true);
    expect(a.can('join', room())).toBe(true);
  });

  it('a private room is invisible and unjoinable to a non-member', () => {
    const priv = room({ visibility: 'private', roomMembers: [] });
    const a = ability(ME);
    expect(a.can('read', priv)).toBe(false);
    expect(a.can('join', priv)).toBe(false);
  });

  it('a pending invitation does not let you in — an accepted one does', () => {
    const a = ability(ME);
    const pending = room({
      visibility: 'private',
      roomMembers: [],
      invitations: [{ inviteeId: ME, status: 'pending', deletedAt: null }],
    });
    const accepted = room({
      visibility: 'private',
      roomMembers: [],
      invitations: [{ inviteeId: ME, status: 'accepted', deletedAt: null }],
    });
    expect(a.can('join', pending)).toBe(false);
    expect(a.can('read', pending)).toBe(false);
    expect(a.can('join', accepted)).toBe(true);
  });

  it('a revoked (soft-deleted) accepted invitation no longer lets you back in', () => {
    const revoked = room({
      visibility: 'private',
      roomMembers: [],
      invitations: [
        { inviteeId: ME, status: 'accepted', deletedAt: new Date() },
      ],
    });
    expect(ability(ME).can('join', revoked)).toBe(false);
  });

  it('only an active member may leave', () => {
    expect(
      ability(ME).can(
        'leave',
        room({ roomMembers: [{ userId: ME, deletedAt: null }] }),
      ),
    ).toBe(true);
    expect(ability(ME).can('leave', room({ roomMembers: [] }))).toBe(false);
  });

  it('a public-room member may invite; a stranger may not; a private room stays the owner’s', () => {
    const publicMember = room({
      roomMembers: [{ userId: ME, deletedAt: null }],
    });
    const publicStranger = room({ roomMembers: [] });
    const privateOwned = room({
      visibility: 'private',
      createdById: ME,
      roomMembers: [{ userId: ME, deletedAt: null }],
    });
    const privateNotOwned = room({
      visibility: 'private',
      createdById: OWNER,
      roomMembers: [{ userId: ME, deletedAt: null }],
    });
    expect(ability(ME).can('invite', publicMember)).toBe(true);
    expect(ability(ME).can('invite', publicStranger)).toBe(false);
    expect(ability(ME).can('invite', privateOwned)).toBe(true);
    expect(ability(ME).can('invite', privateNotOwned)).toBe(false);
  });
});

// =====================================================================
// 5. Invitation subject rights
// =====================================================================

describe('an invitation is private to its two sides', () => {
  const invitation = (over: Record<string, unknown> = {}) =>
    subject('Invitation', {
      deletedAt: null,
      status: 'pending',
      roomId: 7,
      inviterId: OWNER,
      inviteeId: ME,
      ...over,
    } as never);

  it('the invitee and the inviter can read it, nobody else', () => {
    expect(ability(ME).can('read', invitation())).toBe(true);
    expect(ability(OWNER).can('read', invitation())).toBe(true);
    expect(ability(OTHER).can('read', invitation())).toBe(false);
  });

  it('only the invitee may respond, and only while it is pending', () => {
    expect(ability(ME).can('update', invitation())).toBe(true);
    expect(ability(OWNER).can('update', invitation())).toBe(false);
    expect(ability(ME).can('update', invitation({ status: 'accepted' }))).toBe(
      false,
    );
  });

  it('either side may cancel/dismiss it', () => {
    expect(ability(ME).can('delete', invitation())).toBe(true);
    expect(ability(OWNER).can('delete', invitation())).toBe(true);
    expect(ability(OTHER).can('delete', invitation())).toBe(false);
  });

  it('a soft-deleted invitation is inert for everyone', () => {
    const gone = invitation({ deletedAt: new Date() });
    expect(ability(ME).can('read', gone)).toBe(false);
    expect(ability(ME).can('update', gone)).toBe(false);
    expect(ability(OWNER).can('delete', gone)).toBe(false);
  });
});
