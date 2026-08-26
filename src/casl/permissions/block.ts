import { AbilityBuilder } from '@casl/ability';
import { AuthorizationUser } from './role';
import { CrudAction } from './crud';
import { AppAbility } from '../casl-prisma';

export type BlockActions = CrudAction;

export type BlockSubject = 'Block';

export type BlockAbilities = [BlockActions, BlockSubject];

export function defineBlockPermissions(
  { can: allow }: AbilityBuilder<AppAbility>,
  user: AuthorizationUser,
) {
  allow('create', 'Block');

  allow('read', 'Block', {
    blockerId: user.id,
  });

  allow('delete', 'Block', {
    blockerId: user.id,
  });
}
