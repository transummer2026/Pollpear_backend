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

  // Mirrors the moderator's blanket `kick` on rooms: a kick revokes the
  // target's accepted invitation, so a moderator must be able to delete
  // invitations they neither sent nor received.
  if (user.isModerator()) {
    allow(['delete'], 'Invitation', { deletedAt: null });
  }
}
