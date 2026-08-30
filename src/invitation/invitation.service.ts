import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { NotificationService } from 'src/notification/notification.service';
import type { Invitation, User, Room } from 'src/generated/prisma/client';
import {
  InvitationReadSchema,
  type InvitationReadDTO,
  type InvitationCreateDTO,
  type InvitationStatusUpdateDTO,
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

@Injectable()
export class InvitationService {
  constructor(
    private prisma: PrismaService,
    private abilityFactory: CaslAbilityFactory,
    private notificationService: NotificationService,
  ) {}

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

    const outcome = await this.resolveInvitation(
      viewer.id,
      inviteeId,
      roomId,
      body,
    );

    if (outcome.kind === 'created') {
      await this.notificationService.notifyRoomInvitation(
        inviteeId,
        viewer.id,
        room.name,
      );
    }

    return InvitationReadSchema.parse(outcome.invitation);
  }

  async updateInvitation(
    viewer: User,
    roomId: number,
    inviteeId: number,
    status: InvitationStatusUpdateDTO['status'],
  ): Promise<InvitationReadDTO> {
    // now the invitation is available
    const invitation = await this.prisma.invitation.findUnique({
      where: {
        inviteeId_roomId: {
          roomId,
          inviteeId,
        },
      },
    });
    if (!invitation || invitation.deletedAt !== null) {
      throw new NotFoundException(
        'No invitation sent to this user for this room.',
      );
    }
    if (invitation.inviteeId !== viewer.id) {
      throw new ForbiddenException('Cannot update this invitation.');
    }

    if (invitation.status !== 'pending') {
      return InvitationReadSchema.parse(invitation);
    }

    const ability = this.abilityFactory.createForUser(viewer);
    ForbiddenError.from(ability).throwUnlessCan(
      'update',
      subject('Invitation', invitation),
    );

    const updated = await this.prisma.invitation.update({
      where: {
        inviteeId_roomId: {
          roomId,
          inviteeId,
        },
      },
      data: { status },
      include: { room: true },
    });

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

  async removeInvitation(
    viewer: User,
    roomId: number,
    inviteeId: number,
  ): Promise<void> {
    const invitation = await this.prisma.invitation.findUnique({
      where: {
        inviteeId_roomId: {
          roomId,
          inviteeId,
        },
      },
    });
    if (!invitation || invitation.deletedAt !== null) {
      throw new NotFoundException(
        'No invitation sent to this user for this room.',
      );
    }

    const ability = this.abilityFactory.createForUser(viewer);
    ForbiddenError.from(ability).throwUnlessCan(
      'delete',
      subject('Invitation', invitation),
    );

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { deletedAt: new Date() },
    });

    await this.notificationService.clearRoomInvitation(
      invitation.inviteeId,
      invitation.inviterId,
    );
  }

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
}
