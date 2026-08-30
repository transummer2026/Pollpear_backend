import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { NotificationService } from 'src/notification/notification.service';
import { Prisma } from 'src/generated/prisma/client';
import type { Invitation, User, Room } from 'src/generated/prisma/client';
import {
  InvitationReadSchema,
  type InvitationReadDTO,
  type InvitationCreateDTO,
  type InvitationStatusUpdateDTO,
  InvitationListSchema,
  type InvitationListDTO,
} from 'Pollpear_shared/src/schemas/invitations.schema';
import { ForbiddenError, subject } from '@casl/ability';
import { accessibleBy } from '@casl/prisma';

/**
 * a wrapper to define the three cases for the action on an
 * invitation, will be used a bit like a switch case
 */
type InvitationOutcome = {
  invitation: Invitation & { invitee: User; inviter: User; room: Room };
  kind: 'created' | 'accepted' | 'unchanged';
};

/**
 * Handles room invitations: sending, reading, responding to, and cancelling
 * them. An invitation is uniquely identified by the (roomId, inviteeId)
 * pair, so a room can only ever have one live invitation per invitee.
 *
 * Note: accepting an invitation only flips its status to "accepted" here.
 * There is currently no code that turns that into an actual `roomMembers`
 * row (the join flow isn't built yet), so "accepted" has no functional
 * effect on room membership today.
 */
@Injectable()
export class InvitationService {
  constructor(
    private prisma: PrismaService,
    private abilityFactory: CaslAbilityFactory,
    private notificationService: NotificationService,
  ) {}

  /**
   * Fetches the invitation for one specific (room, invitee) pair.
   * Returns null if it doesn't exist, is soft-deleted, or the viewer isn't
   * allowed to see it (only the inviter or the invitee can).
   */
  async getRoomInvitation(
    viewer: User,
    roomId: number,
    inviteeId: number,
  ): Promise<InvitationReadDTO | null> {
    const ability = this.abilityFactory.createForUser(viewer);
    const invitation = await this.prisma.invitation.findFirst({
      where: {
        AND: [
          accessibleBy(ability, 'read').ofType('Invitation'),
          { roomId, inviteeId, deletedAt: null },
        ],
      },
      include: { invitee: true, inviter: true, room: true },
    });
    if (!invitation) return null;

    return InvitationReadSchema.parse(invitation);
  }

  /**
   * Lists the invitations for a room that the viewer is allowed to see
   */
  async getRoomInvitations(
    viewer: User,
    roomId: number,
  ): Promise<InvitationListDTO[]> {
    const ability = this.abilityFactory.createForUser(viewer);
    const invitations = await this.prisma.invitation.findMany({
      where: {
        AND: [
          accessibleBy(ability, 'read').ofType('Invitation'),
          { roomId, deletedAt: null },
        ],
      },
      include: { invitee: true },
    });

    return invitations.map((invitation) =>
      InvitationListSchema.parse({
        inviteeName: invitation.invitee.name,
        status: invitation.status,
      }),
    );
  }

  /**
   * Invites a user to a room. Idempotent by design: calling this again for
   * the same (room, invitee) while an invitation is already pending or
   * accepted just returns that invitation unchanged, rather than erroring
   * or resetting it — see resolveInvitation() for why "accepted" is
   * protected the same way as "pending".
   *
   * Order of checks matters here: room existence, then room-level "invite"
   * permission, then whether the target user can even be interacted with
   * (blocks), then whether they're already a member — each one throws a
   * different error so the caller knows exactly what went wrong.
   */
  async createRoomInvitation(
    viewer: User,
    roomId: number,
    inviteeId: number,
    body: InvitationCreateDTO,
  ): Promise<InvitationReadDTO> {
    const room = await this.prisma.room.findFirst({
      where: {
        id: roomId,
        deletedAt: null,
      },
    });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const ability = this.abilityFactory.createForUser(viewer);
    ForbiddenError.from(ability).throwUnlessCan(
      'invite',
      subject('Room', room),
    );

    const validInvitee = await this.prisma.user.findFirst({
      where: {
        AND: [
          accessibleBy(ability, 'interact').ofType('User'),
          { id: inviteeId, deletedAt: null },
        ],
      },
    });
    if (!validInvitee) {
      throw new ForbiddenException('Cannot send an invitation to this user.');
    }

    const inviteeIsMember = await this.prisma.room.findFirst({
      where: {
        id: roomId,
        deletedAt: null,
        roomMembers: {
          some: {
            userId: inviteeId,
            deletedAt: null,
          },
        },
      },
    });
    if (inviteeIsMember) {
      throw new BadRequestException(
        'Cannot send invitation to an existing room member.',
      );
    }

    let outcome: InvitationOutcome;
    try {
      outcome = await this.resolveInvitation(
        viewer.id,
        inviteeId,
        roomId,
        body,
      );
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      // Lost the race against a concurrent invite to the same (room, invitee):
      // the other request already inserted the row, so re-read it instead of
      // erroring out — this endpoint is meant to be idempotent.
      outcome = await this.resolveInvitation(
        viewer.id,
        inviteeId,
        roomId,
        body,
      );
    }

    if (outcome.kind === 'created') {
      await this.notificationService.notifyRoomInvitation(
        inviteeId,
        viewer.id,
        room.name,
      );
    }

    return InvitationReadSchema.parse(outcome.invitation);
  }

  /**
   * Lets the invitee accept or reject their own invitation. Only the
   * invitee can call this — not the inviter, not anyone else.
   *
   * Once the invitation has already been responded to (status isn't
   * "pending" anymore), this returns it as-is instead of re-processing:
   * that keeps repeated calls (e.g. a double-tap on the client) safe, and
   * avoids re-sending the accepted/cleared notifications below. The write
   * itself is guarded on status: "pending" too, so two concurrent requests
   * can't both fire the notifications.
   */
  async updateRoomInvitation(
    viewer: User,
    roomId: number,
    inviteeId: number,
    status: InvitationStatusUpdateDTO['status'],
  ): Promise<InvitationReadDTO> {
    const ability = this.abilityFactory.createForUser(viewer);
    const invitation = await this.prisma.invitation.findFirst({
      where: {
        AND: [
          accessibleBy(ability, 'read').ofType('Invitation'),
          { roomId, inviteeId, deletedAt: null },
        ],
      },
      include: { invitee: true, inviter: true, room: true },
    });
    if (!invitation) {
      throw new NotFoundException(
        'No invitation sent to this user for this room.',
      );
    }

    // Already responded → idempotent no-op. Only the invitee gets this
    // shortcut; the inviter (who can also read the row) falls through to
    // the CASL check below and is refused.
    if (invitation.status !== 'pending' && invitation.inviteeId === viewer.id) {
      return InvitationReadSchema.parse(invitation);
    }

    ForbiddenError.from(ability).throwUnlessCan(
      'update',
      subject('Invitation', invitation),
    );

    // Conditional write driven by the CASL "update" rule (deletedAt: null,
    // status: 'pending', inviteeId: viewer). Only the request that actually
    // flips the row (count === 1) fires the notifications below; a
    // concurrent double-tap loses the race (count === 0) and just gets the
    // current state back.
    const { count } = await this.prisma.invitation.updateMany({
      where: {
        AND: [
          accessibleBy(ability, 'update').ofType('Invitation'),
          { roomId, inviteeId },
        ],
      },
      data: { status },
    });

    const updated = await this.prisma.invitation.findUnique({
      where: {
        inviteeId_roomId: {
          roomId,
          inviteeId,
        },
      },
      include: { invitee: true, inviter: true, room: true },
    });
    if (!updated) {
      throw new NotFoundException(
        'No invitation sent to this user for this room.',
      );
    }

    if (count === 0) {
      return InvitationReadSchema.parse(updated);
    }

    await this.notificationService.clearRoomInvitation(
      updated.inviteeId,
      updated.inviterId,
    );

    if (status === 'accepted') {
      await this.notificationService.notifyRoomInvitationAccepted(
        updated.inviterId,
        updated.inviteeId,
        updated.room.name,
      );
    }

    return InvitationReadSchema.parse(updated);
  }

  /**
   * Cancels/removes an invitation (soft delete). Either side can do this —
   * the inviter revoking it, or the invitee dismissing it — per the CASL
   * rules in casl/permissions/invitation.ts. A removed invitation can later
   * be re-created via createRoomInvitation(), which revives the same row.
   */
  async removeInvitation(
    viewer: User,
    roomId: number,
    inviteeId: number,
  ): Promise<void> {
    const ability = this.abilityFactory.createForUser(viewer);
    const invitation = await this.prisma.invitation.findFirst({
      where: {
        AND: [
          accessibleBy(ability, 'delete').ofType('Invitation'),
          { roomId, inviteeId, deletedAt: null },
        ],
      },
    });
    if (!invitation) {
      throw new NotFoundException(
        'No invitation sent to this user for this room.',
      );
    }

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { deletedAt: new Date() },
    });

    // Clear both sides: the pending invite shown to the invitee *and* any
    // "X accepted your invitation" notification already delivered to the
    // inviter, so nothing lingers pointing at a now-deleted invitation.
    await this.notificationService.clearRoomNotifications(
      invitation.inviteeId,
      invitation.inviterId,
    );
  }

  /**
   * Creates the invitation row, or revives/refreshes an existing one via
   * upsert on the (inviteeId, roomId) unique key.
   *
   * "pending" and "accepted" existing invitations are left untouched
   * (kind: "unchanged") — re-inviting someone who already said yes must
   * not silently bounce their invitation back to "pending". A "rejected"
   * or soft-deleted one, though, is fair game: the upsert's `update`
   * branch resets it to a fresh "pending" invite, and — importantly —
   * overwrites `message` and `inviterId` too, so the invitation reflects
   * whoever is sending *this* invite, not whoever sent the original one.
   */
  private async resolveInvitation(
    viewerId: number,
    inviteeId: number,
    roomId: number,
    body: InvitationCreateDTO,
  ): Promise<InvitationOutcome> {
    const existing = await this.prisma.invitation.findUnique({
      where: {
        inviteeId_roomId: {
          inviteeId,
          roomId,
        },
      },
      include: {
        invitee: true,
        inviter: true,
        room: true,
      },
    });

    if (existing && existing.deletedAt === null) {
      if (existing.status === 'pending' || existing.status === 'accepted')
        return { invitation: existing, kind: 'unchanged' };
    }

    const invitation = await this.prisma.invitation.upsert({
      where: {
        inviteeId_roomId: {
          inviteeId,
          roomId,
        },
      },
      include: {
        invitee: true,
        inviter: true,
        room: true,
      },
      create: {
        message: body.message,
        inviteeId,
        inviterId: viewerId,
        roomId,
        status: 'pending',
      },
      update: {
        message: body.message,
        inviterId: viewerId,
        deletedAt: null,
        createdAt: new Date(),
        status: 'pending',
      },
    });

    return { invitation, kind: 'created' };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
