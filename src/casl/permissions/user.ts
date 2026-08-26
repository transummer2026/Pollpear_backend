import { AbilityBuilder } from '@casl/ability';
import { AuthorizationUser } from './role';
import { AppAbility } from '../casl-prisma';
import { CrudAction } from './crud';

// this allows you to attach ban to just the user, if you use it for poll wont work
export type UserActions = CrudAction | 'ban' | 'report';

// tupple which will be used in the decorator CheckAbility
// in the decorator useraction <=> user and not useraction <=> poll
//its good practice
export type UserAbilities = [UserActions, 'User'];

export function defineUserPermissions(
  { can: allow, cannot: forbid }: AbilityBuilder<AppAbility>,
  user: AuthorizationUser,
) {
  if (user.isAdmin()) {
    allow('delete', 'User');
    allow('ban', 'User', { role: 'moderator' });
    // grade/degrade a user/moderator/admin — role transition validity
    // (user->moderator, moderator->admin, etc.) is business logic, not CASL
    allow('update', 'User', ['role'], {
      deletedAt: null,
      id: { not: user.id },
    });
  }

  if (user.isModerator()) {
    allow('ban', 'User', { role: 'user' });
  }

  allow(['read', 'report'], 'User', {
    deletedAt: null,
    visibility: { not: 'private' },
    blocksGiven: { none: { blockedId: user.id } },
  });

  allow(['read'], 'User', {
    deletedAt: null,
    id: user.id,
  });

  allow(['update'], 'User', {
    deletedAt: null,
    id: user.id,
  });
  // the self-update rule above has no field restriction — carve out `role`
  // so nobody can grade/degrade themselves through their own profile edit,
  // even an admin (their role change goes through the admin-only rule above,
  // which explicitly excludes their own id)
  forbid('update', 'User', ['role'], {
    id: user.id,
  });

  allow(['delete'], 'User', {
    deletedAt: null,
    id: user.id,
  });
}
