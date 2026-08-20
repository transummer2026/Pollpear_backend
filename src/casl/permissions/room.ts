import { AbilityBuilder } from '@casl/ability';
import { AuthorizationUser } from './role';
import { CrudAction } from './crud';
import { AppAbility } from '../casl-prisma';

export type RoomActions = CrudAction | 'moderate' | 'join' | 'invite' | 'kick';

export type RoomAbilities = [RoomActions, 'Room'];

export function defineRoomPermissions(
  { can: allow }: AbilityBuilder<AppAbility>,
  user: AuthorizationUser,
) {
  if (user.isAdmin()) {
    allow('delete', 'Room');
  }

  if (user.isModerator()) {
    allow('moderate', 'Room');
    allow('kick', 'Room');
  }

  allow('create', 'Room');
  allow('read', 'Room', { status: 'active', visibility: 'public' });
  allow('read', 'Room', {
    status: 'active',
    roomMembers: { some: { userId: user.id } },
  });
  allow('join', 'Room', { status: 'active', visibility: 'public' });
  allow('join', 'Room', {
    status: 'active',
    invitations: { some: { inviteeId: user.id, status: 'accepted' } },
  });

  allow('invite', 'Room', {
    status: 'active',
    roomMembers: { some: { userId: user.id } },
  });

  // room owner

  allow('update', 'Room', { createdById: user.id });
  allow('delete', 'Room', { createdById: user.id });
  allow('kick', 'Room', { status: 'active', createdById: user.id });
  allow('moderate', 'Room', { createdById: user.id });
}
