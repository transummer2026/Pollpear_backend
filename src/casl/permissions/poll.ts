import { AbilityBuilder } from '@casl/ability';
import { AuthorizationUser } from './role';
import { CrudAction } from './crud';
import { AppAbility } from '../casl-prisma';

export type PollActions = CrudAction | 'moderate' | 'vote' | 'report';

export type PollSubject = 'Poll' | 'PollVote' | 'PollOption';

export type PollAbilities = [PollActions, PollSubject];

export function definePollPermissions(
  { can: allow }: AbilityBuilder<AppAbility>,
  user: AuthorizationUser,
) {
  if (user.isAdmin()) {
    allow('delete', 'Poll', { status: 'pending' });
  }

  if (user.isModerator()) {
    allow('moderate', 'Poll');
  }

  allow(['read', 'create'], 'Poll');
  allow(['update', 'delete'], 'Poll', {
    status: 'pending',
    createdById: user.id,
  });
}
