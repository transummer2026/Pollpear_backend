import { AbilityBuilder } from '@casl/ability';
import { AuthorizationUser } from './role';
import { CrudAction } from './crud';
import { AppAbility } from '../casl-prisma';

export type HashtagActions = CrudAction;

export type HashtagAbilities = [HashtagActions, 'Hashtag'];

export function defineHashtagPermissions(
  { can: allow }: AbilityBuilder<AppAbility>,
  user: AuthorizationUser,
) {
  if (user.isAdmin()) {
    allow('read', 'Hashtag');
  }

  if (user.isModerator()) {
    allow('delete', 'Hashtag');
  }

  allow('create', 'Hashtag');

  allow(['read'], 'Hashtag', {
    deletedAt: null,
  });
}
