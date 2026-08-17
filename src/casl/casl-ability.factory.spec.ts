import { subject } from '@casl/ability';
import { Poll, User, UserRole } from 'src/generated/prisma/client';
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
    it('grants nothing on Room today: defineRoomPermissions is not wired into definePermissionsArray', () => {
      const ability = abilityFor(UserRole.admin);

      expect(ability.can('read', 'Room')).toBe(false);
      expect(ability.can('moderate', 'Room')).toBe(false);
      expect(ability.can('delete', 'Room')).toBe(false);
    });
  });
});
