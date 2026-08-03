import { AbilityBuilder } from '@casl/ability';
import { AuthorizationUser } from './role';
import { CrudAction } from './crud';
import { AppAbility } from '../casl-prisma';

export type PollSubject = 'Poll';

export type PollActions = CrudAction | 'moderate' | 'vote';

export type OrderAbilities = [PollActions, PollSubject];

export function defineUserPermissions(
  { can: allow }: AbilityBuilder<AppAbility>,
  user: AuthorizationUser,
) {
  if (user.isAdmin()) {
    allow('delete', 'Poll', { status: 'pending' });
  }

  if (user.isModerator()) {
    allow('moderate', 'Poll');
  }

  allow(['read', 'create', 'vote'], 'Poll');
  allow(['update', 'delete'], 'Poll', {
    status: 'pending',
    createdById: user.id,
  });
}
