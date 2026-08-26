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
  allow('read', 'Friendship', {
    deletedAt: null,
    status: 'accepted',
    requester: { is: { visibility: { not: 'private' } } },
    addressee: { is: { visibility: { not: 'private' } } },
  });
  allow('read', 'Friendship', {
    deletedAt: null,
    requesterId: user.id,
  });
  allow('read', 'Friendship', {
    deletedAt: null,
    addresseeId: user.id,
  });
  allow('update', 'Friendship', {
    deletedAt: null,
    status: 'pending',
    addresseeId: user.id,
  });
  allow('delete', 'Friendship', {
    deletedAt: null,
    requesterId: user.id,
  });
  allow('delete', 'Friendship', {
    deletedAt: null,
    addresseeId: user.id,
  });
}
