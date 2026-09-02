import { AbilityBuilder } from '@casl/ability';
import { AuthorizationUser } from './role';
import { AppAbility } from '../casl-prisma';
import { CrudAction } from './crud';

export type UserActions = CrudAction | 'ban' | 'report' | 'interact';

export type UserAbilities = [UserActions, 'User'];

export function defineUserPermissions(
  { can: allow, cannot: forbid }: AbilityBuilder<AppAbility>,
  user: AuthorizationUser,
) {
  if (user.isAdmin()) {
    allow('delete', 'User');
    allow('ban', 'User', { role: 'moderator' });
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
    blocksReceived: { none: { blockerId: user.id } },
  });
  allow(['read'], 'User', {
    deletedAt: null,
    id: user.id,
  });

  allow(['interact'], 'User', {
    deletedAt: null,
    visibility: { not: 'private' },
    blocksGiven: { none: { blockedId: user.id } },
    blocksReceived: { none: { blockerId: user.id } },
  });

  allow(['update'], 'User', {
    deletedAt: null,
    id: user.id,
  });
  forbid('update', 'User', ['role'], {
    id: user.id,
  });

  allow(['delete'], 'User', {
    deletedAt: null,
    id: user.id,
  });
}
