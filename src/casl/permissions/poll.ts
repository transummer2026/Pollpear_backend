import { AbilityBuilder } from '@casl/ability';
import { AuthorizationUser } from './role';
import { CrudAction } from './crud';
import { AppAbility } from '../casl-prisma';

export type PollActions = CrudAction | 'report';

export type PollSubject = 'Poll' | 'PollOption';

export type PollAbilities = [PollActions, PollSubject];

/**
 * A poll filed in a room follows the room's rights: membership is the only
 * way in, whatever the poll's own `visibility`. Every other branch is
 * therefore pinned to `roomId: null` — they only ever describe a standalone
 * (feed) poll. Leaving or being kicked from the room takes the poll with it,
 * for its author as much as for anyone else.
 */
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
      roomId: null,
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
    // The two branches below are `roomId: null` for the same reason as in
    // pollReadConditions: a room poll is voted on through room membership
    // only. There is deliberately no "public poll in an active room" branch —
    // making a room poll public must not open it to the whole site.
    {
      deletedAt: null,
      visibility: 'private' as const,
      createdById: user.id,
      roomId: null,
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
  // A room poll may only be added by an active member of that room — the
  // same gate as posting a message (permissions/message.ts). Without the
  // membership clause any authenticated user (a pending invitee, or a
  // non-member of a public room) could inject polls into a room they never
  // joined.
  allow(['create'], 'Poll', {
    room: {
      is: {
        deletedAt: null,
        status: 'active',
        roomMembers: { some: { userId: user.id, deletedAt: null } },
      },
    },
  });

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
