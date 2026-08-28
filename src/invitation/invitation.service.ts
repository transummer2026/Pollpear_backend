import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { NotificationService } from 'src/notification/notification.service';
import type { Invitation, User } from 'src/generated/prisma/client';
import type { InvitationStatusUpdateDTO } from 'Pollpear_shared/src/schemas/invitations.schema';

@Injectable()
export class InvitationService {
  constructor(
    private prisma: PrismaService,
    private abilityFactory: CaslAbilityFactory,
    private notificationService: NotificationService,
  ) {}

  createRoomInvitation(
    viewer: User,
    roomId: number,
    inviteeId: number,
  ): Promise<Invitation> {
    void viewer;
    void roomId;
    void inviteeId;
    throw new Error('TODO');
  }

  respondToInvitation(
    viewer: User,
    roomId: number,
    inviteeId: number,
    status: InvitationStatusUpdateDTO['status'],
  ): Promise<Invitation> {
    void viewer;
    void roomId;
    void inviteeId;
    void status;
    throw new Error('TODO');
  }

  removeInvitation(
    viewer: User,
    roomId: number,
    inviteeId: number,
  ): Promise<void> {
    void viewer;
    void roomId;
    void inviteeId;
    throw new Error('TODO');
  }
}
