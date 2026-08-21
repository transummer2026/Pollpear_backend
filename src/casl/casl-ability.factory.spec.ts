import { subject } from '@casl/ability';
import {
  Block,
  Friendship,
  Poll,
  Room,
  User,
  UserRole,
} from 'src/generated/prisma/client';
import { CaslAbilityFactory } from './casl-ability.factory';

function abilityFor(role: UserRole, id = 1) {
  return new CaslAbilityFactory().createForUser({ id, role } as User);
}

function userSubject(attrs: Partial<User>) {
  return subject('User', attrs as User);
}

function pollSubject(attrs: Partial<Poll>) {
  return subject('Poll', attrs as Poll);
}

function roomSubject(attrs: Partial<Room> & Record<string, unknown>) {
  return subject('Room', attrs as Room);
}

function friendshipSubject(attrs: Partial<Friendship>) {
  return subject('Friendship', attrs as Friendship);
}

function blockSubject(attrs: Partial<Block>) {
  return subject('Block', attrs as Block);
}

describe('CaslAbilityFactory', () => {
  describe('user role', () => {
    const ability = abilityFor(UserRole.user);

    it('grants read on any User', () => {
      expect(ability.can('read', userSubject({ id: 99 }))).toBe(true);
    });

    it('grants update on the requesting user own User only', () => {
      expect(ability.can('update', userSubject({ id: 1 }))).toBe(true);
      expect(ability.can('update', userSubject({ id: 2 }))).toBe(false);
    });

    it('denies delete and ban on User', () => {
      expect(ability.can('delete', userSubject({ id: 1 }))).toBe(false);
      expect(ability.can('ban', userSubject({ id: 2 }))).toBe(false);
    });

    it('denies moderate on Poll', () => {
      expect(ability.can('moderate', 'Poll')).toBe(false);
    });

    it('grants read and create on Poll', () => {
      expect(ability.can('read', 'Poll')).toBe(true);
      expect(ability.can('create', 'Poll')).toBe(true);
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

    it('grants create, update and delete on PollVote', () => {
      expect(ability.can('create', 'PollVote')).toBe(true);
      expect(ability.can('update', 'PollVote')).toBe(true);
      expect(ability.can('delete', 'PollVote')).toBe(true);
    });
  });

  describe('moderator role', () => {
    const ability = abilityFor(UserRole.moderator);

    it('gains ban on any User', () => {
      expect(ability.can('ban', userSubject({ id: 99 }))).toBe(true);
    });

    it('gains moderate on Poll', () => {
      expect(ability.can('moderate', 'Poll')).toBe(true);
    });

    it('still cannot delete a User', () => {
      expect(ability.can('delete', userSubject({ id: 99 }))).toBe(false);
    });

    it('still cannot delete a pending Poll authored by someone else', () => {
      const poll = pollSubject({ status: 'pending', createdById: 99 });

      expect(ability.can('delete', poll)).toBe(false);
    });
  });

  describe('admin role', () => {
    const ability = abilityFor(UserRole.admin);

    it('gains delete on any User', () => {
      expect(ability.can('delete', userSubject({ id: 99 }))).toBe(true);
    });

    it('keeps the moderator grants: ban on User and moderate on Poll', () => {
      expect(ability.can('ban', userSubject({ id: 99 }))).toBe(true);
      expect(ability.can('moderate', 'Poll')).toBe(true);
    });

    it('gains delete on a pending Poll authored by someone else', () => {
      const poll = pollSubject({ status: 'pending', createdById: 99 });

      expect(ability.can('delete', poll)).toBe(true);
    });

    it.each(['active', 'closed'] as const)(
      'denies delete on a %s Poll authored by someone else',
      (status) => {
        const poll = pollSubject({ status, createdById: 99 });

        expect(ability.can('delete', poll)).toBe(false);
      },
    );
  });

  describe('Room', () => {
    describe('user role', () => {
      const ability = abilityFor(UserRole.user);

      it('grants create on Room', () => {
        expect(ability.can('create', 'Room')).toBe(true);
      });

      it('grants moderate on the user own Room only', () => {
        expect(ability.can('moderate', roomSubject({ createdById: 1 }))).toBe(
          true,
        );
        expect(ability.can('moderate', roomSubject({ createdById: 99 }))).toBe(
          false,
        );
      });

      it('grants read on an active public Room', () => {
        const room = roomSubject({ status: 'active', visibility: 'public' });

        expect(ability.can('read', room)).toBe(true);
      });

      it('denies read on a closed public Room for a non-member', () => {
        const room = roomSubject({
          status: 'closed',
          visibility: 'public',
          roomMembers: [],
        });

        expect(ability.can('read', room)).toBe(false);
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

      it('denies read on a closed Room even for a member', () => {
        const room = roomSubject({
          status: 'closed',
          visibility: 'public',
          roomMembers: [{ userId: 1 }],
        });

        expect(ability.can('read', room)).toBe(false);
      });

      it('grants join on an active public Room', () => {
        const room = roomSubject({ status: 'active', visibility: 'public' });

        expect(ability.can('join', room)).toBe(true);
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

      it('grants invite on an active Room the user is a member of', () => {
        const room = roomSubject({
          status: 'active',
          visibility: 'private',
          roomMembers: [{ userId: 1 }],
        });

        expect(ability.can('invite', room)).toBe(true);
      });

      it('denies invite on a Room the user is not a member of', () => {
        const room = roomSubject({
          status: 'active',
          visibility: 'public',
          roomMembers: [],
        });

        expect(ability.can('invite', room)).toBe(false);
      });

      it('grants update and delete on the user own Room', () => {
        const room = roomSubject({ createdById: 1 });

        expect(ability.can('update', room)).toBe(true);
        expect(ability.can('delete', room)).toBe(true);
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

      it('gains moderate on Room', () => {
        expect(ability.can('moderate', 'Room')).toBe(true);
      });

      it('gains kick on any Room', () => {
        const room = roomSubject({ status: 'active', createdById: 99 });

        expect(ability.can('kick', room)).toBe(true);
      });

      it('still cannot delete a Room created by someone else', () => {
        const room = roomSubject({ createdById: 99 });

        expect(ability.can('delete', room)).toBe(false);
      });
    });

    describe('admin role', () => {
      const ability = abilityFor(UserRole.admin);

      it('gains delete on any Room', () => {
        const room = roomSubject({ createdById: 99 });

        expect(ability.can('delete', room)).toBe(true);
      });
    });
  });
  describe('Friendship', () => {
    const ability = abilityFor(UserRole.user);

    it('grants create to everyone', () => {
      expect(ability.can('create', 'Friendship')).toBe(true);
    });

    it('grants read on any accepted friendship', () => {
      expect(
        ability.can(
          'read',
          friendshipSubject({
            status: 'accepted',
            requesterId: 8,
            addresseeId: 9,
          }),
        ),
      ).toBe(true);
    });

    it('grants read on a pending friendship only to its two sides', () => {
      expect(
        ability.can(
          'read',
          friendshipSubject({
            status: 'pending',
            requesterId: 1,
            addresseeId: 2,
          }),
        ),
      ).toBe(true);
      expect(
        ability.can(
          'read',
          friendshipSubject({
            status: 'pending',
            requesterId: 2,
            addresseeId: 1,
          }),
        ),
      ).toBe(true);
      expect(
        ability.can(
          'read',
          friendshipSubject({
            status: 'pending',
            requesterId: 8,
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
            requesterId: 2,
            addresseeId: 1,
          }),
        ),
      ).toBe(true);
      expect(
        ability.can(
          'update',
          friendshipSubject({
            status: 'pending',
            requesterId: 1,
            addresseeId: 2,
          }),
        ),
      ).toBe(false);
      expect(
        ability.can(
          'update',
          friendshipSubject({
            status: 'accepted',
            requesterId: 2,
            addresseeId: 1,
          }),
        ),
      ).toBe(false);
    });

    it('grants delete only to a side of the friendship', () => {
      expect(
        ability.can(
          'delete',
          friendshipSubject({ requesterId: 1, addresseeId: 2 }),
        ),
      ).toBe(true);
      expect(
        ability.can(
          'delete',
          friendshipSubject({ requesterId: 2, addresseeId: 1 }),
        ),
      ).toBe(true);
      expect(
        ability.can(
          'delete',
          friendshipSubject({ requesterId: 8, addresseeId: 9 }),
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
});
