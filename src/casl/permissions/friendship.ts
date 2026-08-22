import { AbilityBuilder } from '@casl/ability';
import { AuthorizationUser } from './role';
import { CrudAction } from './crud';
import { AppAbility } from '../casl-prisma';

export type FriendshipActions = CrudAction;

export type FriendshipSubject = 'Friendship' | 'Block';

export type FriendshipAbilities = [FriendshipActions, FriendshipSubject];

export function defineFriendshipPermissions(
  { can: allow }: AbilityBuilder<AppAbility>,
  user: AuthorizationUser,
) {
  allow('create', 'Friendship');
  allow('read', 'Friendship', { status: 'accepted' });
  allow('read', 'Friendship', { requesterId: user.id });
  allow('read', 'Friendship', { addresseeId: user.id });
  allow('update', 'Friendship', { status: 'pending', addresseeId: user.id });
  allow('delete', 'Friendship', { requesterId: user.id });
  allow('delete', 'Friendship', { addresseeId: user.id });

  allow('create', 'Block');
  allow('read', 'Block', { blockerId: user.id });
  allow('delete', 'Block', { blockerId: user.id });
}
