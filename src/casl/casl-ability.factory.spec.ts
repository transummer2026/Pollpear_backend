import { subject } from '@casl/ability';
import {
  Block,
  Friendship,
  Hashtag,
  Message,
  Option,
  Poll,
  Room,
  User,
  UserRole,
  Vote,
} from 'src/generated/prisma/client';
import { CaslAbilityFactory } from './casl-ability.factory';

function abilityFor(role: UserRole, id = 1) {
  return new CaslAbilityFactory().createForUser({ id, role });
}

function userSubject(attrs: Partial<User>) {
  return subject('User', attrs as User);
}

function pollSubject(attrs: Partial<Poll> & Record<string, unknown>) {
  return subject('Poll', attrs as Poll);
}

function roomSubject(attrs: Partial<Room> & Record<string, unknown>) {
  return subject('Room', attrs as Room);
}

function friendshipSubject(
  attrs: Partial<Friendship> & Record<string, unknown>,
) {
  return subject('Friendship', attrs as Friendship);
}

function blockSubject(attrs: Partial<Block>) {
  return subject('Block', attrs as Block);
}

function hashtagSubject(attrs: Partial<Hashtag>) {
  return subject('Hashtag', attrs as Hashtag);
}

function voteSubject(attrs: Partial<Vote> & Record<string, unknown>) {
  return subject('Vote', attrs as Vote);
}

function pollOptionSubject(attrs: Partial<Option> & Record<string, unknown>) {
  return subject('PollOption', attrs as Option);
}

function messageSubject(attrs: Partial<Message> & Record<string, unknown>) {
  return subject('Message', attrs as Message);
}

describe('CaslAbilityFactory', () => {
  describe('user role', () => {
    const ability = abilityFor(UserRole.user);

    it('grants read on a public User', () => {
      expect(
        ability.can('read', userSubject({ id: 99, visibility: 'public' })),
      ).toBe(true);
    });

    it('denies read on a public User who blocked the requester', () => {
      expect(
        ability.can(
          'read',
          userSubject({
            id: 99,
            visibility: 'public',
            blocksGiven: [{ blockedId: 1 }],
          } as Partial<User> & Record<string, unknown>),
        ),
      ).toBe(false);
    });

    it('denies read on a public User the requester blocked', () => {
      expect(
        ability.can(
          'read',
          userSubject({
            id: 99,
            visibility: 'public',
            blocksReceived: [{ blockerId: 1 }],
          } as Partial<User> & Record<string, unknown>),
        ),
      ).toBe(false);
    });

    it('grants interact on a private User the requester has no block with', () => {
      expect(
        ability.can('interact', userSubject({ id: 99, visibility: 'private' })),
      ).toBe(true);
    });

    it('denies interact on a User who blocked the requester', () => {
      expect(
        ability.can(
          'interact',
          userSubject({
            id: 99,
            visibility: 'private',
            blocksGiven: [{ blockedId: 1 }],
          } as Partial<User> & Record<string, unknown>),
        ),
      ).toBe(false);
    });

    it('denies interact on a User the requester blocked', () => {
      expect(
        ability.can(
          'interact',
          userSubject({
            id: 99,
            visibility: 'private',
            blocksReceived: [{ blockerId: 1 }],
          } as Partial<User> & Record<string, unknown>),
        ),
      ).toBe(false);
    });

    it('denies read on a private User that is not the requester', () => {
      expect(
        ability.can('read', userSubject({ id: 99, visibility: 'private' })),
      ).toBe(false);
    });

    it('grants read on the requester own private User', () => {
      expect(
        ability.can('read', userSubject({ id: 1, visibility: 'private' })),
      ).toBe(true);
    });

    it('grants update on the requesting user own User only', () => {
      expect(ability.can('update', userSubject({ id: 1 }))).toBe(true);
      expect(ability.can('update', userSubject({ id: 2 }))).toBe(false);
    });

    it('denies delete and ban on a User other than themselves', () => {
      expect(ability.can('delete', userSubject({ id: 2 }))).toBe(false);
      expect(ability.can('ban', userSubject({ id: 2 }))).toBe(false);
    });

    it('grants read and create on Poll', () => {
      expect(ability.can('read', 'Poll')).toBe(true);
      expect(ability.can('create', 'Poll')).toBe(true);
    });

    it('denies read on a public Poll whose creator blocked the requester', () => {
      const poll = pollSubject({
        deletedAt: null,
        visibility: 'public',
        createdById: 2,
        createdBy: { blocksGiven: [{ blockedId: 1 }] },
      });

      expect(ability.can('read', poll)).toBe(false);
    });

    it('denies read on a public Poll whose creator the requester blocked', () => {
      const poll = pollSubject({
        deletedAt: null,
        visibility: 'public',
        createdById: 2,
        createdBy: { blocksReceived: [{ blockerId: 1 }] },
      });

      expect(ability.can('read', poll)).toBe(false);
    });

    it('grants update and delete on the user own pending Poll', () => {
      const poll = pollSubject({ status: 'pending', createdById: 1 });

      expect(ability.can('update', poll)).toBe(true);
      expect(ability.can('delete', poll)).toBe(true);
    });

    it('denies update and delete on a pending Poll authored by someone else', () => {
      const poll = pollSubject({ status: 'pending', createdById: 2 });

      expect(ability.can('update', poll)).toBe(false);
      expect(ability.can('delete', poll)).toBe(false);
    });

    it.each(['active', 'closed'] as const)(
      'denies update and delete on the user own %s Poll',
      (status) => {
        const poll = pollSubject({ status, createdById: 1 });

        expect(ability.can('update', poll)).toBe(false);
        expect(ability.can('delete', poll)).toBe(false);
      },
    );

    it('grants create, update and delete on Vote', () => {
      expect(ability.can('create', 'Vote')).toBe(true);
      expect(ability.can('update', 'Vote')).toBe(true);
      expect(ability.can('delete', 'Vote')).toBe(true);
    });

    it('grants update/delete on the user own vote while the poll is open, denies once closed', () => {
      const open = voteSubject({
        deletedAt: null,
        createdById: 1,
        poll: { status: 'active' },
      });
      const closed = voteSubject({
        deletedAt: null,
        createdById: 1,
        poll: { status: 'closed' },
      });

      expect(ability.can('update', open)).toBe(true);
      expect(ability.can('delete', open)).toBe(true);
      expect(ability.can('update', closed)).toBe(false);
      expect(ability.can('delete', closed)).toBe(false);
    });

    it('denies update/delete on another user own vote', () => {
      const othersVote = voteSubject({
        deletedAt: null,
        createdById: 2,
        poll: { status: 'active' },
      });

      expect(ability.can('update', othersVote)).toBe(false);
      expect(ability.can('delete', othersVote)).toBe(false);
    });

    it('grants create on a Poll with no room, or attached to an active room', () => {
      expect(ability.can('create', pollSubject({ roomId: null }))).toBe(true);
      expect(
        ability.can(
          'create',
          pollSubject({ roomId: 1, room: { status: 'active' } }),
        ),
      ).toBe(true);
    });

    it('denies create on a Poll attached to a closed room', () => {
      const poll = pollSubject({ roomId: 1, room: { status: 'closed' } });

      expect(ability.can('create', poll)).toBe(false);
    });

    it('grants create on a Vote for a public Poll with no room, or attached to an active room', () => {
      const noRoom = voteSubject({
        poll: {
          visibility: 'public',
          deletedAt: null,
          roomId: null,
          createdBy: { blocksGiven: [], blocksReceived: [] },
        },
      });
      const activeRoom = voteSubject({
        poll: {
          visibility: 'public',
          deletedAt: null,
          roomId: 1,
          room: { status: 'active' },
          createdBy: { blocksGiven: [], blocksReceived: [] },
        },
      });

      expect(ability.can('create', noRoom)).toBe(true);
      expect(ability.can('create', activeRoom)).toBe(true);
    });

    it('denies create on a Vote for a public Poll attached to a closed room', () => {
      const vote = voteSubject({
        poll: {
          visibility: 'public',
          deletedAt: null,
          roomId: 1,
          room: { status: 'closed' },
        },
      });

      expect(ability.can('create', vote)).toBe(false);
    });

    it('denies create on a Vote for a public Poll whose creator blocked the requester', () => {
      const vote = voteSubject({
        poll: {
          visibility: 'public',
          deletedAt: null,
          roomId: null,
          createdBy: { blocksGiven: [{ blockedId: 1 }] },
        },
      });

      expect(ability.can('create', vote)).toBe(false);
    });

    it('denies create on a Vote for a public Poll whose creator the requester blocked', () => {
      const vote = voteSubject({
        poll: {
          visibility: 'public',
          deletedAt: null,
          roomId: null,
          createdBy: { blocksReceived: [{ blockerId: 1 }] },
        },
      });

      expect(ability.can('create', vote)).toBe(false);
    });
  });

  describe('moderator role', () => {
    const ability = abilityFor(UserRole.moderator);

    it('gains ban on a plain User, but not on a moderator or an admin', () => {
      expect(ability.can('ban', userSubject({ id: 99, role: 'user' }))).toBe(
        true,
      );
      expect(
        ability.can('ban', userSubject({ id: 99, role: 'moderator' })),
      ).toBe(false);
      expect(ability.can('ban', userSubject({ id: 99, role: 'admin' }))).toBe(
        false,
      );
    });

    it('still cannot delete a User', () => {
      expect(ability.can('delete', userSubject({ id: 99 }))).toBe(false);
    });

    it('gains delete on any Poll, for moderation off a report', () => {
      const poll = pollSubject({ status: 'pending', createdById: 99 });

      expect(ability.can('delete', poll)).toBe(true);
    });

    it('gains read on any live Poll/PollOption/Vote, but not a deleted one', () => {
      const livePoll = pollSubject({
        deletedAt: null,
        visibility: 'private',
        createdById: 99,
      });
      const deletedPoll = pollSubject({
        deletedAt: new Date(),
        visibility: 'private',
        createdById: 99,
      });
      const liveOption = pollOptionSubject({ deletedAt: null });
      const deletedOption = pollOptionSubject({ deletedAt: new Date() });
      const liveVote = voteSubject({ deletedAt: null, createdById: 99 });
      const deletedVote = voteSubject({
        deletedAt: new Date(),
        createdById: 99,
      });

      expect(ability.can('read', livePoll)).toBe(true);
      expect(ability.can('read', deletedPoll)).toBe(false);
      expect(ability.can('read', liveOption)).toBe(true);
      expect(ability.can('read', deletedOption)).toBe(false);
      expect(ability.can('read', liveVote)).toBe(true);
      expect(ability.can('read', deletedVote)).toBe(false);
    });
  });

  describe('admin role', () => {
    const ability = abilityFor(UserRole.admin);

    it('gains delete on any User', () => {
      expect(ability.can('delete', userSubject({ id: 99 }))).toBe(true);
    });

    it('gains ban on a plain User or a moderator, but not another admin', () => {
      expect(ability.can('ban', userSubject({ id: 99, role: 'user' }))).toBe(
        true,
      );
      expect(
        ability.can('ban', userSubject({ id: 99, role: 'moderator' })),
      ).toBe(true);
      expect(ability.can('ban', userSubject({ id: 99, role: 'admin' }))).toBe(
        false,
      );
    });

    it('grants grading/degrading (updating only the role field) of another User', () => {
      const other = userSubject({ id: 99, deletedAt: null });

      expect(ability.can('update', other, 'role')).toBe(true);
      expect(ability.can('update', other, 'name')).toBe(false);
    });

    it('denies grading/degrading their own role', () => {
      const self = userSubject({ id: 1, deletedAt: null });

      expect(ability.can('update', self, 'role')).toBe(false);
    });

    it.each(['pending', 'active', 'closed'] as const)(
      'gains delete on a %s Poll authored by someone else, for moderation off a report',
      (status) => {
        const poll = pollSubject({ status, createdById: 99 });

        expect(ability.can('delete', poll)).toBe(true);
      },
    );

    it('gains read on a deleted Poll/PollOption/Vote too', () => {
      const deletedPoll = pollSubject({
        deletedAt: new Date(),
        visibility: 'private',
        createdById: 99,
      });
      const deletedOption = pollOptionSubject({ deletedAt: new Date() });
      const deletedVote = voteSubject({
        deletedAt: new Date(),
        createdById: 99,
      });

      expect(ability.can('read', deletedPoll)).toBe(true);
      expect(ability.can('read', deletedOption)).toBe(true);
      expect(ability.can('read', deletedVote)).toBe(true);
    });
  });

  describe('Room', () => {
    describe('user role', () => {
      const ability = abilityFor(UserRole.user);

      it('grants create on Room', () => {
        expect(ability.can('create', 'Room')).toBe(true);
      });

      it('grants read on an active public Room', () => {
        const room = roomSubject({
          status: 'active',
          visibility: 'public',
          createdBy: { blocksGiven: [] },
        });

        expect(ability.can('read', room)).toBe(true);
      });

      it('denies read on an active public Room whose creator blocked the viewer', () => {
        const room = roomSubject({
          status: 'active',
          visibility: 'public',
          createdBy: { blocksGiven: [{ blockedId: 1 }] },
        });

        expect(ability.can('read', room)).toBe(false);
      });

      it('denies read on an active public Room whose creator the viewer blocked', () => {
        const room = roomSubject({
          status: 'active',
          visibility: 'public',
          createdBy: { blocksReceived: [{ blockerId: 1 }] },
        });

        expect(ability.can('read', room)).toBe(false);
      });

      it('still grants read on a closed public Room for a non-member', () => {
        const room = roomSubject({
          status: 'closed',
          visibility: 'public',
          roomMembers: [],
          createdBy: { blocksGiven: [] },
        });

        expect(ability.can('read', room)).toBe(true);
      });

      it('denies read on a private Room for a non-member', () => {
        const room = roomSubject({
          status: 'active',
          visibility: 'private',
          roomMembers: [],
        });

        expect(ability.can('read', room)).toBe(false);
      });

      it('grants read on a private Room the user is a member of', () => {
        const room = roomSubject({
          status: 'active',
          visibility: 'private',
          roomMembers: [{ userId: 1 }],
        });

        expect(ability.can('read', room)).toBe(true);
      });

      it('still grants read on a closed Room for a member', () => {
        const room = roomSubject({
          status: 'closed',
          visibility: 'public',
          roomMembers: [{ userId: 1 }],
        });

        expect(ability.can('read', room)).toBe(true);
      });

      it('grants join on an active public Room', () => {
        const room = roomSubject({
          status: 'active',
          visibility: 'public',
          createdBy: { blocksGiven: [] },
        });

        expect(ability.can('join', room)).toBe(true);
      });

      it('denies join on an active public Room whose creator blocked the viewer', () => {
        const room = roomSubject({
          status: 'active',
          visibility: 'public',
          createdBy: { blocksGiven: [{ blockedId: 1 }] },
        });

        expect(ability.can('join', room)).toBe(false);
      });

      it('denies join on an active public Room whose creator the viewer blocked', () => {
        const room = roomSubject({
          status: 'active',
          visibility: 'public',
          createdBy: { blocksReceived: [{ blockerId: 1 }] },
        });

        expect(ability.can('join', room)).toBe(false);
      });

      it('denies join on a closed Room', () => {
        const room = roomSubject({
          status: 'closed',
          visibility: 'public',
          invitations: [],
        });

        expect(ability.can('join', room)).toBe(false);
      });

      it('denies join on a private Room without an accepted invitation', () => {
        const room = roomSubject({
          status: 'active',
          visibility: 'private',
          invitations: [{ inviteeId: 1, status: 'pending' }],
        });

        expect(ability.can('join', room)).toBe(false);
      });

      it('grants join on a private Room with an accepted invitation', () => {
        const room = roomSubject({
          status: 'active',
          visibility: 'private',
          invitations: [{ inviteeId: 1, status: 'accepted' }],
        });

        expect(ability.can('join', room)).toBe(true);
      });

      it('denies join on a private Room when the accepted invitation targets someone else', () => {
        const room = roomSubject({
          status: 'active',
          visibility: 'private',
          invitations: [{ inviteeId: 99, status: 'accepted' }],
        });

        expect(ability.can('join', room)).toBe(false);
      });

      it('grants invite on an active public Room the user is a member of', () => {
        const room = roomSubject({
          status: 'active',
          visibility: 'public',
          roomMembers: [{ userId: 1 }],
        });

        expect(ability.can('invite', room)).toBe(true);
      });

      it('denies invite on a public Room the user is not a member of', () => {
        const room = roomSubject({
          status: 'active',
          visibility: 'public',
          roomMembers: [],
        });

        expect(ability.can('invite', room)).toBe(false);
      });

      it('grants invite on a private Room only to its owner, not a regular member', () => {
        const owner = roomSubject({
          status: 'active',
          visibility: 'private',
          createdById: 1,
          roomMembers: [{ userId: 1 }],
        });
        const member = roomSubject({
          status: 'active',
          visibility: 'private',
          createdById: 99,
          roomMembers: [{ userId: 1 }],
        });

        expect(ability.can('invite', owner)).toBe(true);
        expect(ability.can('invite', member)).toBe(false);
      });

      it('grants leave on a Room the user is a member of, even if closed', () => {
        const room = roomSubject({
          status: 'closed',
          roomMembers: [{ userId: 1, deletedAt: null }],
        });

        expect(ability.can('leave', room)).toBe(true);
      });

      it('denies leave on a Room the user is not a member of', () => {
        const room = roomSubject({ status: 'active', roomMembers: [] });

        expect(ability.can('leave', room)).toBe(false);
      });

      it('grants update on any field of the user own active Room', () => {
        const room = roomSubject({ status: 'active', createdById: 1 });

        expect(ability.can('update', room)).toBe(true);
        expect(ability.can('update', room, 'name')).toBe(true);
        expect(ability.can('update', room, 'status')).toBe(true);
      });

      it('restricts update on the user own closed Room to the status field, to allow reopening', () => {
        const room = roomSubject({ status: 'closed', createdById: 1 });

        expect(ability.can('update', room, 'status')).toBe(true);
        expect(ability.can('update', room, 'name')).toBe(false);
      });

      it('grants delete on the user own Room regardless of status', () => {
        const active = roomSubject({ status: 'active', createdById: 1 });
        const closed = roomSubject({ status: 'closed', createdById: 1 });

        expect(ability.can('delete', active)).toBe(true);
        expect(ability.can('delete', closed)).toBe(true);
      });

      it('denies update and delete on a Room created by someone else, even when the Room id matches the user id', () => {
        const room = roomSubject({ id: 1, createdById: 99 });

        expect(ability.can('update', room)).toBe(false);
        expect(ability.can('delete', room)).toBe(false);
      });

      it('grants kick on the user own active Room', () => {
        const room = roomSubject({ status: 'active', createdById: 1 });

        expect(ability.can('kick', room)).toBe(true);
      });

      it('denies kick on the user own closed Room', () => {
        const room = roomSubject({ status: 'closed', createdById: 1 });

        expect(ability.can('kick', room)).toBe(false);
      });

      it('denies kick on an active Room created by someone else', () => {
        const room = roomSubject({ status: 'active', createdById: 99 });

        expect(ability.can('kick', room)).toBe(false);
      });
    });

    describe('moderator role', () => {
      const ability = abilityFor(UserRole.moderator);

      it('gains kick on any Room', () => {
        const room = roomSubject({ status: 'active', createdById: 99 });

        expect(ability.can('kick', room)).toBe(true);
      });

      it('gains delete on any Room, for moderation off a report', () => {
        const room = roomSubject({ createdById: 99 });

        expect(ability.can('delete', room)).toBe(true);
      });

      it('gains read on any live Room, but not a deleted one', () => {
        const live = roomSubject({
          deletedAt: null,
          visibility: 'private',
          createdById: 99,
          roomMembers: [],
        });
        const deleted = roomSubject({
          deletedAt: new Date(),
          visibility: 'private',
          createdById: 99,
          roomMembers: [],
        });

        expect(ability.can('read', live)).toBe(true);
        expect(ability.can('read', deleted)).toBe(false);
      });
    });

    describe('admin role', () => {
      const ability = abilityFor(UserRole.admin);

      it('gains delete on any Room', () => {
        const room = roomSubject({ createdById: 99 });

        expect(ability.can('delete', room)).toBe(true);
      });

      it('gains read on a deleted Room too', () => {
        const deleted = roomSubject({
          deletedAt: new Date(),
          visibility: 'private',
          createdById: 99,
          roomMembers: [],
        });

        expect(ability.can('read', deleted)).toBe(true);
      });
    });
  });
  describe('Friendship', () => {
    const ability = abilityFor(UserRole.user);

    it('grants create to everyone', () => {
      expect(ability.can('create', 'Friendship')).toBe(true);
    });

    it('grants read on any accepted friendship between two public profiles', () => {
      expect(
        ability.can(
          'read',
          friendshipSubject({
            status: 'accepted',
            userAId: 8,
            userBId: 9,
            addresseeId: 9,
            userA: { visibility: 'public' },
            userB: { visibility: 'public' },
          }),
        ),
      ).toBe(true);
    });

    it('denies read on an accepted friendship where either side is private', () => {
      const userAPrivate = friendshipSubject({
        status: 'accepted',
        userAId: 8,
        userBId: 9,
        addresseeId: 9,
        userA: { visibility: 'private' },
        userB: { visibility: 'public' },
      });
      const userBPrivate = friendshipSubject({
        status: 'accepted',
        userAId: 8,
        userBId: 9,
        addresseeId: 9,
        userA: { visibility: 'public' },
        userB: { visibility: 'private' },
      });

      expect(ability.can('read', userAPrivate)).toBe(false);
      expect(ability.can('read', userBPrivate)).toBe(false);
    });

    it('denies read on a friendship where either side blocked the requester', () => {
      const userABlockedRequester = friendshipSubject({
        status: 'accepted',
        userAId: 8,
        userBId: 9,
        addresseeId: 9,
        userA: { visibility: 'public', blocksGiven: [{ blockedId: 1 }] },
        userB: { visibility: 'public' },
      });
      const userBBlockedRequester = friendshipSubject({
        status: 'accepted',
        userAId: 8,
        userBId: 9,
        addresseeId: 9,
        userA: { visibility: 'public' },
        userB: { visibility: 'public', blocksGiven: [{ blockedId: 1 }] },
      });

      expect(ability.can('read', userABlockedRequester)).toBe(false);
      expect(ability.can('read', userBBlockedRequester)).toBe(false);
    });

    it('denies read on a friendship where the requester blocked either side', () => {
      const requesterBlockedUserA = friendshipSubject({
        status: 'accepted',
        userAId: 8,
        userBId: 9,
        addresseeId: 9,
        userA: { visibility: 'public', blocksReceived: [{ blockerId: 1 }] },
        userB: { visibility: 'public' },
      });
      const requesterBlockedUserB = friendshipSubject({
        status: 'accepted',
        userAId: 8,
        userBId: 9,
        addresseeId: 9,
        userA: { visibility: 'public' },
        userB: { visibility: 'public', blocksReceived: [{ blockerId: 1 }] },
      });

      expect(ability.can('read', requesterBlockedUserA)).toBe(false);
      expect(ability.can('read', requesterBlockedUserB)).toBe(false);
    });

    it('grants read to the user sitting in the second slot of the pair', () => {
      const abilityB = abilityFor(UserRole.user, 5);

      expect(
        abilityB.can(
          'read',
          friendshipSubject({
            status: 'pending',
            userAId: 3,
            userBId: 5,
            addresseeId: 3,
          }),
        ),
      ).toBe(true);
    });

    it('grants delete to the user sitting in the second slot of the pair', () => {
      const abilityB = abilityFor(UserRole.user, 5);

      expect(
        abilityB.can(
          'delete',
          friendshipSubject({ userAId: 3, userBId: 5, addresseeId: 3 }),
        ),
      ).toBe(true);
    });

    it('grants read on a pending friendship only to its two sides', () => {
      expect(
        ability.can(
          'read',
          friendshipSubject({
            status: 'pending',
            userAId: 1,
            userBId: 2,
            addresseeId: 2,
          }),
        ),
      ).toBe(true);
      expect(
        ability.can(
          'read',
          friendshipSubject({
            status: 'pending',
            userAId: 1,
            userBId: 2,
            addresseeId: 1,
          }),
        ),
      ).toBe(true);
      expect(
        ability.can(
          'read',
          friendshipSubject({
            status: 'pending',
            userAId: 8,
            userBId: 9,
            addresseeId: 9,
          }),
        ),
      ).toBe(false);
    });

    it('grants update only to the addressee of a pending request', () => {
      expect(
        ability.can(
          'update',
          friendshipSubject({
            status: 'pending',
            userAId: 1,
            userBId: 2,
            addresseeId: 1,
          }),
        ),
      ).toBe(true);
      expect(
        ability.can(
          'update',
          friendshipSubject({
            status: 'pending',
            userAId: 1,
            userBId: 2,
            addresseeId: 2,
          }),
        ),
      ).toBe(false);
      expect(
        ability.can(
          'update',
          friendshipSubject({
            status: 'accepted',
            userAId: 1,
            userBId: 2,
            addresseeId: 1,
          }),
        ),
      ).toBe(false);
    });

    it('grants delete only to a side of the friendship', () => {
      expect(
        ability.can(
          'delete',
          friendshipSubject({ userAId: 1, userBId: 2, addresseeId: 2 }),
        ),
      ).toBe(true);
      expect(
        ability.can(
          'delete',
          friendshipSubject({ userAId: 1, userBId: 2, addresseeId: 1 }),
        ),
      ).toBe(true);
      expect(
        ability.can(
          'delete',
          friendshipSubject({ userAId: 8, userBId: 9, addresseeId: 9 }),
        ),
      ).toBe(false);
    });
  });

  describe('Block', () => {
    const ability = abilityFor(UserRole.user);

    it('grants create to everyone', () => {
      expect(ability.can('create', 'Block')).toBe(true);
    });

    it('grants read and delete only on own blocks', () => {
      expect(ability.can('read', blockSubject({ blockerId: 1 }))).toBe(true);
      expect(ability.can('read', blockSubject({ blockerId: 2 }))).toBe(false);
      expect(ability.can('delete', blockSubject({ blockerId: 1 }))).toBe(true);
      expect(ability.can('delete', blockSubject({ blockerId: 2 }))).toBe(false);
    });
  });

  describe('Hashtag', () => {
    const live = { name: 'raph', deletedAt: null };
    const deleted = { name: 'bla', deletedAt: new Date() };

    describe('user role', () => {
      const ability = abilityFor(UserRole.user);

      it('grants create to everyone', () => {
        expect(ability.can('create', 'Hashtag')).toBe(true);
      });

      it('grants read and report on a live Hashtag', () => {
        expect(ability.can('read', hashtagSubject(live))).toBe(true);
        expect(ability.can('report', hashtagSubject(live))).toBe(true);
      });

      it('denies read and report on a deleted Hashtag', () => {
        expect(ability.can('read', hashtagSubject(deleted))).toBe(false);
        expect(ability.can('report', hashtagSubject(deleted))).toBe(false);
      });

      it('denies update and delete on a live Hashtag', () => {
        expect(ability.can('update', hashtagSubject(live))).toBe(false);
        expect(ability.can('delete', hashtagSubject(live))).toBe(false);
      });
    });

    describe('moderator role', () => {
      const ability = abilityFor(UserRole.moderator);

      it('gains delete on a Hashtag, live or deleted', () => {
        expect(ability.can('delete', hashtagSubject(live))).toBe(true);
        expect(ability.can('delete', hashtagSubject(deleted))).toBe(true);
      });

      it('never gains update — Hashtags cannot be revived by anyone', () => {
        expect(ability.can('update', hashtagSubject(live))).toBe(false);
        expect(ability.can('update', hashtagSubject(deleted))).toBe(false);
      });

      it('still cannot read a deleted Hashtag', () => {
        expect(ability.can('read', hashtagSubject(deleted))).toBe(false);
      });
    });

    describe('admin role', () => {
      const ability = abilityFor(UserRole.admin);

      it('gains delete on a Hashtag', () => {
        expect(ability.can('delete', hashtagSubject(live))).toBe(true);
      });

      it('gains read on a deleted Hashtag', () => {
        expect(ability.can('read', hashtagSubject(deleted))).toBe(true);
      });

      it('never gains update — Hashtags cannot be revived, not even by an admin', () => {
        expect(ability.can('update', hashtagSubject(deleted))).toBe(false);
      });

      it('gains no action that was never granted', () => {
        expect(ability.can('ban', hashtagSubject(live))).toBe(false);
      });
    });
  });

  describe('Message', () => {
    describe('user role', () => {
      const ability = abilityFor(UserRole.user);

      it('grants create/read/report on a Message in the user own Room', () => {
        const message = messageSubject({
          deletedAt: null,
          roomId: 1,
          room: {
            deletedAt: null,
            status: 'active',
            roomMembers: [{ userId: 1, deletedAt: null }],
          },
        });

        expect(ability.can('create', message)).toBe(true);
        expect(ability.can('read', message)).toBe(true);
        expect(ability.can('report', message)).toBe(true);
      });

      it('denies create/read/report on a Message in a Room the user is not a member of', () => {
        const message = messageSubject({
          deletedAt: null,
          roomId: 1,
          room: { roomMembers: [] },
        });

        expect(ability.can('create', message)).toBe(false);
        expect(ability.can('read', message)).toBe(false);
        expect(ability.can('report', message)).toBe(false);
      });

      it('never gains update or delete, even on the user own Message', () => {
        const message = messageSubject({
          deletedAt: null,
          authorId: 1,
          roomId: 1,
          room: { roomMembers: [{ userId: 1, deletedAt: null }] },
        });

        expect(ability.can('update', message)).toBe(false);
        expect(ability.can('delete', message)).toBe(false);
      });
    });

    describe('moderator role', () => {
      const ability = abilityFor(UserRole.moderator);

      it('gains delete on any Message, for moderation off a report', () => {
        const message = messageSubject({ deletedAt: null, authorId: 99 });

        expect(ability.can('delete', message)).toBe(true);
      });

      it('gains read on any live Message, but not a deleted one', () => {
        const live = messageSubject({ deletedAt: null, authorId: 99 });
        const deleted = messageSubject({
          deletedAt: new Date(),
          authorId: 99,
        });

        expect(ability.can('read', live)).toBe(true);
        expect(ability.can('read', deleted)).toBe(false);
      });
    });

    describe('admin role', () => {
      const ability = abilityFor(UserRole.admin);

      it('gains read on a deleted Message too', () => {
        const deleted = messageSubject({
          deletedAt: new Date(),
          authorId: 99,
        });

        expect(ability.can('read', deleted)).toBe(true);
      });
    });
  });
});
