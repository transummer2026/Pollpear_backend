import { AbilityBuilder } from '@casl/ability';
import { AuthorizationUser } from './role';
import { AppAbility } from '../casl-prisma';
import { CrudAction } from './crud';

export type BanActions = CrudAction;

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
