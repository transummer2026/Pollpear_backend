import { UserRole } from 'src/generated/prisma/client';
import { AuthorizationUser } from './role';

function makeUser(role: UserRole): AuthorizationUser {
  return new AuthorizationUser(1, role);
}

describe('AuthorizationUser', () => {
  describe('isAdmin', () => {
    it.each([
      [UserRole.admin, true],
      [UserRole.moderator, false],
      [UserRole.user, false],
    ])('evaluates the %s role as %s', (role, expected) => {
      expect(makeUser(role).isAdmin()).toBe(expected);
    });
  });

  describe('isModerator', () => {
    it.each([
      [UserRole.moderator, true],
      [UserRole.user, false],
    ])('evaluates the %s role as %s', (role, expected) => {
      expect(makeUser(role).isModerator()).toBe(expected);
    });

    it('treats an admin as a moderator too', () => {
      expect(makeUser(UserRole.admin).isModerator()).toBe(true);
    });
  });
});
