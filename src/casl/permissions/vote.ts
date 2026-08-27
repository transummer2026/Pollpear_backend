import { AbilityBuilder } from '@casl/ability';
import { AuthorizationUser } from './role';
import { CrudAction } from './crud';
import { AppAbility } from '../casl-prisma';
import { pollReadConditions, pollVotableConditions } from './poll';

export type VoteActions = CrudAction | 'report';

export type VoteSubject = 'Vote';

export type VoteAbilities = [VoteActions, VoteSubject];

export function defineVotePermissions(
  { can: allow }: AbilityBuilder<AppAbility>,
  user: AuthorizationUser,
) {
  if (user.isAdmin()) {
    allow('read', 'Vote');
  }

  if (user.isModerator()) {
    allow('read', 'Vote', { deletedAt: null });
    allow('delete', 'Vote');
  }

  for (const condition of pollVotableConditions(user)) {
    allow(['create'], 'Vote', {
      poll: { is: condition },
    });
  }

  allow(['read'], 'Vote', {
    deletedAt: null,
    createdById: user.id,
  });

  allow(['update', 'delete'], 'Vote', {
    deletedAt: null,
    createdById: user.id,
    poll: { is: { status: { not: 'closed' } } },
  });

  for (const condition of pollReadConditions(user)) {
    allow(['report'], 'Vote', {
      deletedAt: null,
      poll: { is: condition },
    });
  }
}
