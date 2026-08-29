import { AbilityBuilder } from '@casl/ability';
import { AuthorizationUser } from './role';
import { CrudAction } from './crud';
import { AppAbility } from '../casl-prisma';

export type PollActions = CrudAction | 'report';

export type PollSubject = 'Poll' | 'PollOption';

export type PollAbilities = [PollActions, PollSubject];

export function pollReadConditions(user: AuthorizationUser) {
  return [
    {
      deletedAt: null,
      room: {
        is: { roomMembers: { some: { userId: user.id, deletedAt: null } } },
      },
    },
    {
      deletedAt: null,
      visibility: 'private' as const,
      createdById: user.id,
    },
    {
      deletedAt: null,
      visibility: 'public' as const,
      createdBy: {
        is: {
          blocksGiven: { none: { blockedId: user.id } },
          blocksReceived: { none: { blockerId: user.id } },
        },
      },
    },
  ];
}

/**
 * Same eligibility as {@link pollReadConditions}, but additionally closed
 * to a poll whose room has been closed. Kept separate from the read
 * conditions: a closed room stays readable, it just stops taking new
 * polls/votes. Flattened into standalone conditions (no nested `OR`) so
 * each one can be used directly as a relation filter (e.g. `poll: cond`)
 * — `@casl/prisma` only accepts `OR`/`AND` at the top level of a rule's
 * condition, not nested inside a relation field's value. Every hop through
 * a to-one relation (`room`) is wrapped in Prisma's `is` operator — without
 * it, `ability.can()`/`throwUnlessCan()` throw instead of just not matching
 * (a to-one relation without `is` is only safe through `accessibleBy`,
 * which talks straight to Prisma's real query engine).
 */
export function pollVotableConditions(user: AuthorizationUser) {
  return [
    {
      deletedAt: null,
      room: {
        is: {
          roomMembers: { some: { userId: user.id, deletedAt: null } },
          status: 'active' as const,
        },
      },
    },
    {
      deletedAt: null,
      visibility: 'private' as const,
      createdById: user.id,
      roomId: null,
    },
    {
      deletedAt: null,
      visibility: 'private' as const,
      createdById: user.id,
      room: { is: { status: 'active' as const } },
    },
    {
      deletedAt: null,
      visibility: 'public' as const,
      roomId: null,
      createdBy: {
        is: {
          blocksGiven: { none: { blockedId: user.id } },
          blocksReceived: { none: { blockerId: user.id } },
        },
      },
    },
    {
      deletedAt: null,
      visibility: 'public' as const,
      room: { is: { status: 'active' as const } },
      createdBy: {
        is: {
          blocksGiven: { none: { blockedId: user.id } },
          blocksReceived: { none: { blockerId: user.id } },
        },
      },
    },
  ];
}

export function definePollPermissions(
  { can: allow }: AbilityBuilder<AppAbility>,
  user: AuthorizationUser,
) {
  if (user.isAdmin()) {
    allow('read', 'Poll');
    allow('read', 'PollOption');
  }

  if (user.isModerator()) {
    allow('read', 'Poll', { deletedAt: null });
    allow('read', 'PollOption', { deletedAt: null });
    allow('delete', 'Poll');
    allow('delete', 'PollOption');
  }

  allow(['create'], 'Poll', { roomId: null });
  allow(['create'], 'Poll', { room: { is: { status: 'active' } } });

  for (const condition of pollReadConditions(user)) {
    allow(['read', 'report'], 'Poll', condition);
    allow(['report'], 'PollOption', {
      deletedAt: null,
      poll: { is: condition },
    });
  }

  allow(['update', 'delete'], 'Poll', {
    deletedAt: null,
    status: 'pending',
    createdById: user.id,
  });
}
