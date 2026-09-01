import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  HttpCode,
  Body,
  Query,
  Logger,
  Res,
} from '@nestjs/common';
import { type Response } from 'express';
import { RoomsService } from './rooms.service';
import type {
  RoomCreateDTO,
  RoomUpdateDTO,
} from 'Pollpear_shared/src/schemas/rooms.schema';
import {
  RoomCreateSchema,
  RoomUpdateSchema,
} from 'Pollpear_shared/src/schemas/rooms.schema';
import type {
  InvitationCreateDTO,
  InvitationStatusUpdateDTO,
} from 'Pollpear_shared/src/schemas/invitations.schema';
import {
  InvitationCreateSchema,
  InvitationStatusUpdateSchema,
} from 'Pollpear_shared/src/schemas/invitations.schema';
import { CheckAbilities } from 'src/common/decorators/check-ability.decorator';
import { MessagesService } from 'src/messages/messages.service';
import {
  MessageHistoryQuerySchema,
  type MessageHistoryQueryDTO,
} from 'Pollpear_shared/src/schemas/messages.schema';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import type { User } from 'src/generated/prisma/client';
import { InvitationService } from 'src/invitation/invitation.service';

@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly messagesService: MessagesService,
    private readonly invitationService: InvitationService,
    private logger: Logger,
  ) {}

  @Get()
  @CheckAbilities(['read', 'Room'])
  findMeManyRooms(
    @CurrentUser() viewer: User,
    @Query('userId') targetUserId?: string,
  ) {
    if (targetUserId) {
      this.logger.debug('targetId is captured in the url');
      return this.roomsService.findUsersManyRooms(viewer, +targetUserId);
    }
    this.logger.debug('Only userId is captured in the url');
    return this.roomsService.findMeManyRooms(viewer);
  }

  @Get('feed')
  @CheckAbilities(['read', 'Room'])
  findManyRooms(@CurrentUser() viewer: User) {
    return this.roomsService.findManyRooms(viewer);
  }

  @Get(':id')
  @CheckAbilities(['read', 'Room'])
  findOneRoom(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() viewer: User,
  ) {
    return this.roomsService.findOneRoom(id, viewer);
  }

  @Post('new')
  @CheckAbilities(['create', 'Room'])
  create(
    @CurrentUser() viewer: User,
    @Body(new ZodValidationPipe(RoomCreateSchema)) body: RoomCreateDTO,
  ) {
    return this.roomsService.create(viewer, body);
  }

  @Patch(':id')
  @CheckAbilities(['update', 'Room'])
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() viewer: User,
    @Body(new ZodValidationPipe(RoomUpdateSchema)) body: RoomUpdateDTO,
  ) {
    return this.roomsService.update(id, viewer, body);
  }

  @Delete(':id')
  @CheckAbilities(['delete', 'Room'])
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() viewer: User) {
    return this.roomsService.remove(id, viewer);
  }

  @Get(':id/invitations')
  @CheckAbilities(['read', 'Invitation'])
  getRoomInvitations(
    @CurrentUser() viewer: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.invitationService.getRoomInvitations(viewer, id);
  }

  @Get(':id/invitations/:userId')
  @CheckAbilities(['read', 'Invitation'])
  async getRoomInvitation(
    @CurrentUser() viewer: User,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const invitation = await this.invitationService.getRoomInvitation(
      viewer,
      id,
      userId,
    );
    if (!invitation) {
      res.status(204);
      return;
    }
    return invitation;
  }

  @Post(':id/invitations/:userId')
  @HttpCode(201)
  @CheckAbilities(['invite', 'Room'])
  createInvitation(
    @CurrentUser() viewer: User,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body(new ZodValidationPipe(InvitationCreateSchema))
    body: InvitationCreateDTO,
  ) {
    return this.invitationService.createRoomInvitation(
      viewer,
      id,
      userId,
      body,
    );
  }

  @Patch(':id/invitations/:userId')
  @CheckAbilities(['update', 'Invitation'])
  respondToInvitation(
    @CurrentUser() viewer: User,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body(new ZodValidationPipe(InvitationStatusUpdateSchema))
    body: InvitationStatusUpdateDTO,
  ) {
    return this.invitationService.updateRoomInvitation(
      viewer,
      id,
      userId,
      body.status,
    );
  }

  @Delete(':id/invitations/:userId')
  @HttpCode(204)
  @CheckAbilities(['delete', 'Invitation'])
  removeInvitation(
    @CurrentUser() viewer: User,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.invitationService.removeInvitation(viewer, id, userId);
  }

  @Post(':id/participants')
  @HttpCode(201)
  @CheckAbilities(['join', 'Room'])
  addParticipant(
    @CurrentUser() viewer: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.roomsService.addParticipant(viewer, id);
  }

  // Coarse gate only: this route serves both `leave` (userId === caller)
  // and `kick` (userId !== caller). `removeParticipant` picks and enforces
  // the right ability per target via `accessibleBy`.
  @Delete(':id/participants/:userId')
  @HttpCode(204)
  @CheckAbilities(['leave', 'Room'])
  removeParticipant(
    @CurrentUser() viewer: User,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.roomsService.removeParticipant(viewer, id, userId);
  }

  @Get(':id/messages')
  @CheckAbilities(['read', 'Message'])
  getMessages(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() viewer: User,
    @Query(new ZodValidationPipe(MessageHistoryQuerySchema))
    query: MessageHistoryQueryDTO,
  ) {
    return this.messagesService.listForRoom(id, viewer, query);
  }
}
