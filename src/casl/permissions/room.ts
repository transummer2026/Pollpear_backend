import { AbilityBuilder } from '@casl/ability';
import { AuthorizationUser } from './role';
import { CrudAction } from './crud';
import { AppAbility } from '../casl-prisma';

export type RoomActions =
  | CrudAction
  | 'join'
  | 'invite'
  | 'kick'
  | 'leave'
  | 'report';

export type RoomAbilities = [RoomActions, 'Room'];

export function roomReadConditions(user: AuthorizationUser) {
  return [
    {
      deletedAt: null,
      visibility: 'public' as const,
    },
    {
      deletedAt: null,
      roomMembers: { some: { userId: user.id, deletedAt: null } },
    },
  ];
}

export function roomJoinConditions(user: AuthorizationUser) {
  return [
    {
      deletedAt: null,
      status: 'active' as const,
      visibility: 'public' as const,
    },
    {
      deletedAt: null,
      status: 'active' as const,
      invitations: {
        some: { inviteeId: user.id, status: 'accepted' as const },
      },
    },
  ];
}

export function defineRoomPermissions(
  { can: allow }: AbilityBuilder<AppAbility>,
  user: AuthorizationUser,
) {
  if (user.isAdmin()) {
    allow('read', 'Room');
  }

  if (user.isModerator()) {
    allow('read', 'Room', { deletedAt: null });
    allow('delete', 'Room');
    allow('kick', 'Room');
  }

  for (const condition of roomReadConditions(user)) {
    allow(['read', 'report'], 'Room', condition);
  }

  for (const condition of roomJoinConditions(user)) {
    allow(['join'], 'Room', condition);
  }

  allow('create', 'Room');

  // public room: any active member can invite; private room: owner only
  // (kept in sync with invitation.ts's create rule)
  allow('invite', 'Room', {
    deletedAt: null,
    status: 'active',
    visibility: 'public',
    roomMembers: { some: { userId: user.id, deletedAt: null } },
  });
  allow('invite', 'Room', {
    deletedAt: null,
    status: 'active',
    visibility: 'private',
    createdById: user.id,
  });

  allow('leave', 'Room', {
    deletedAt: null,
    roomMembers: { some: { userId: user.id, deletedAt: null } },
  });

  // room owner

  allow('update', 'Room', {
    deletedAt: null,
    status: 'active',
    createdById: user.id,
  });
  allow('update', 'Room', ['status'], {
    deletedAt: null,
    status: 'closed',
    createdById: user.id,
  });
  allow('delete', 'Room', {
    deletedAt: null,
    createdById: user.id,
  });
  allow('kick', 'Room', {
    deletedAt: null,
    status: 'active',
    createdById: user.id,
  });
}
