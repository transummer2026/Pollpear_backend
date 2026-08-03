import { AbilityBuilder } from '@casl/ability';
import { AuthorizationUser } from './role';
import { CrudAction } from './crud';
import { AppAbility } from '../casl-prisma';

export type RoomActions = CrudAction | 'moderate';

export type RoomAbilities = [RoomActions, 'Room'];

/**
 * 
 * @todo:   // allow('create', 'Room', { status: 'public' });

  // //room owner
  // allow('delete', 'Room', { ownerId: user.id });
  // allow('update', 'Room', { ownerId: user.id });
 */
export function defineRoomPermissions(
  { can: allow }: AbilityBuilder<AppAbility>,
  user: AuthorizationUser,
) {
  if (user.isAdmin()) {
    allow('delete', 'Room');
  }

  if (user.isModerator()) {
    allow('moderate', 'Room');
  }
  allow('read', 'Room');
}
