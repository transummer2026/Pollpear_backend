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
  { can: allow }: AbilityBuilder<AppAbility>,
  user: AuthorizationUser,
) {
  if (user.isAdmin()) {
    allow('delete', 'User');
  }

  if (user.isModerator()) {
    allow('ban', 'User');
  }

  allow('read', 'User', { visibility: { not: 'private' } });
  allow('read', 'User', { id: user.id });
  allow('update', 'User', { id: user.id });
}
