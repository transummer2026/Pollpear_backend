import { AbilityBuilder } from '@casl/ability';
import { AuthorizationUser } from './role';
import { CrudAction } from './crud';
import { AppAbility } from '../casl-prisma';

export type MessageActions = CrudAction | 'report';

export type MessageSubject = 'Message';

export type MessageAbilities = [MessageActions, MessageSubject];

// live websocket chat: no update, no self-delete — only a moderator can
// remove a message (moderation off a report), authors can't edit or
// delete their own once sent
export function defineMessagePermissions(
  { can: allow }: AbilityBuilder<AppAbility>,
  user: AuthorizationUser,
) {
  if (user.isAdmin()) {
    allow('read', 'Message');
  }

  if (user.isModerator()) {
    allow('read', 'Message', { deletedAt: null });
    allow('delete', 'Message');
  }

  allow(['read', 'report'], 'Message', {
    deletedAt: null,
    room: {
      is: { roomMembers: { some: { userId: user.id, deletedAt: null } } },
    },
  });

  allow('create', 'Message', {
    room: {
      is: {
        deletedAt: null,
        status: 'active',
        roomMembers: { some: { userId: user.id, deletedAt: null } },
      },
    },
  });
}
