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
    userA: { is: { visibility: { not: 'private' } } },
    userB: { is: { visibility: { not: 'private' } } },
  });
  allow('read', 'Friendship', {
    deletedAt: null,
    userAId: user.id,
  });
  allow('read', 'Friendship', {
    deletedAt: null,
    userBId: user.id,
  });
  allow('update', 'Friendship', {
    deletedAt: null,
    status: 'pending',
    addresseeId: user.id,
  });
  allow('delete', 'Friendship', {
    deletedAt: null,
    userAId: user.id,
  });
  allow('delete', 'Friendship', {
    deletedAt: null,
    userBId: user.id,
  });
}
