import { AbilityBuilder } from '@casl/ability';
import { AuthorizationUser } from './role';
import { CrudAction } from './crud';
import { AppAbility } from '../casl-prisma';

export type InvitationActions = CrudAction;

export type InvitationSubject = 'Invitation';

export type InvitationAbilities = [InvitationActions, InvitationSubject];

export function defineInvitationPermissions(
  { can: allow }: AbilityBuilder<AppAbility>,
  user: AuthorizationUser,
) {
  allow(['read'], 'Invitation', {
    deletedAt: null,
    inviterId: user.id,
  });
  allow(['read'], 'Invitation', {
    deletedAt: null,
    inviteeId: user.id,
  });

  allow(['update'], 'Invitation', {
    deletedAt: null,
    status: 'pending',
    inviteeId: user.id,
  });

  allow(['delete'], 'Invitation', {
    deletedAt: null,
    inviterId: user.id,
  });
  allow(['delete'], 'Invitation', {
    deletedAt: null,
    inviteeId: user.id,
  });
}
