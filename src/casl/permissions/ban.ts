import { AbilityBuilder } from '@casl/ability';
import { AuthorizationUser } from './role';
import { AppAbility } from '../casl-prisma';
import { CrudAction } from './crud';

// this allows you to attach ban to just the user, if you use it for poll wont work
export type BanActions = CrudAction;

// tupple which will be used in the decorator CheckAbility
// in the decorator useraction <=> user and not useraction <=> poll
//its good practice
export type BanAbilities = [BanActions, 'Ban'];

export function defineBanPermissions(
  { can: allow }: AbilityBuilder<AppAbility>,
  user: AuthorizationUser,
) {
  if (user.isAdmin()) {
    allow(['create', 'update', 'delete'], 'Ban', {
      user: { is: { role: 'moderator' } },
    });
  }

  if (user.isModerator()) {
    allow('read', 'Ban');
    allow(['create', 'update', 'delete'], 'Ban', {
      user: { is: { role: 'user' } },
    });
  }

  allow(['read'], 'Ban', {
    userId: user.id,
  });
}
