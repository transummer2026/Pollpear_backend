import { AbilityBuilder } from '@casl/ability';
import { AuthorizationUser } from './role';
import { CrudAction } from './crud';
import { AppAbility } from '../casl-prisma';

export type RoomActions = CrudAction | 'join' | 'invite' | 'kick' | 'leave';

export type RoomAbilities = [RoomActions, 'Room'];

function notBlockedByCreator(user: AuthorizationUser) {
  return {
    is: {
      blocksGiven: { none: { blockedId: user.id } },
      blocksReceived: { none: { blockerId: user.id } },
    },
  };
}

function activeMembership(user: AuthorizationUser) {
  return { some: { userId: user.id, deletedAt: null } };
}

function acceptedInvitation(user: AuthorizationUser) {
  return {
    some: { inviteeId: user.id, status: 'accepted' as const, deletedAt: null },
  };
}

export function roomReadConditions(user: AuthorizationUser) {
  return [
    {
      deletedAt: null,
      visibility: 'public' as const,
      createdBy: notBlockedByCreator(user),
    },
    {
      deletedAt: null,
      roomMembers: activeMembership(user),
    },
  ];
}

export function roomJoinConditions(user: AuthorizationUser) {
  return [
    {
      deletedAt: null,
      status: 'active' as const,
      visibility: 'public' as const,
      createdBy: notBlockedByCreator(user),
    },
    {
      deletedAt: null,
      status: 'active' as const,
      invitations: acceptedInvitation(user),
    },
  ];
}

export function roomInviteConditions(user: AuthorizationUser) {
  return [
    {
      deletedAt: null,
      status: 'active' as const,
      visibility: 'public' as const,
      roomMembers: activeMembership(user),
    },
    {
      deletedAt: null,
      status: 'active' as const,
      visibility: 'private' as const,
      createdById: user.id,
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

  allow('create', 'Room');

  for (const condition of roomReadConditions(user)) {
    allow(['read'], 'Room', condition);
  }

  for (const condition of roomJoinConditions(user)) {
    allow(['join'], 'Room', condition);
  }

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

  for (const condition of roomInviteConditions(user)) {
    allow('invite', 'Room', condition);
  }

  allow('leave', 'Room', {
    deletedAt: null,
    roomMembers: activeMembership(user),
  });

  allow('kick', 'Room', {
    deletedAt: null,
    status: 'active',
    createdById: user.id,
  });
}
