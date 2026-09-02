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

  // Changing or clearing a vote needs the same standing as casting one: the
  // poll must still be votable *for this user right now* (membership included),
  // not just "mine and not closed". Otherwise a member who votes, then leaves
  // the room, keeps editing that vote from the feed forever.
  for (const condition of pollVotableConditions(user)) {
    allow(['update', 'delete'], 'Vote', {
      deletedAt: null,
      createdById: user.id,
      poll: { is: { ...condition, status: { not: 'closed' } } },
    });
  }

  for (const condition of pollReadConditions(user)) {
    allow(['report'], 'Vote', {
      deletedAt: null,
      poll: { is: condition },
    });
  }
}
