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
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import type {
  RoomCreateDTO,
  RoomUpdateDTO,
} from 'Pollpear_shared/src/schemas/rooms.schema';
import {
  RoomCreateSchema,
  RoomUpdateSchema,
} from 'Pollpear_shared/src/schemas/rooms.schema';
import { CheckAbilities } from 'src/common/decorators/check-ability.decorator';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserId } from 'src/common/decorators/user-id.decorator';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';

@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @CheckAbilities(['read', 'Room'])
  findMeManyRooms(@UserId() userId: number) {
    return this.roomsService.findMeManyRooms(userId);
  }

  @Get('feed')
  @CheckAbilities(['read', 'Room'])
  findManyRooms(@UserId() userId: number) {
    return this.roomsService.findManyRooms(userId);
  }

  @Get(':id')
  @CheckAbilities(['read', 'Room'])
  findMeOneRoom(
    @Param('id', ParseIntPipe) id: number,
    @UserId() userId: number,
  ) {
    return this.roomsService.findMeOneRoom(id, userId);
  }

  @Post('new')
  @CheckAbilities(['create', 'Room'])
  create(
    @UserId() userId: number,
    @Body(new ZodValidationPipe(RoomCreateSchema)) body: RoomCreateDTO,
  ) {
    return this.roomsService.create(userId, body);
  }

  @Patch(':id')
  @CheckAbilities(['update', 'Room'])
  update(
    @Param('id', ParseIntPipe) id: number,
    @UserId() userId: number,
    @Body(new ZodValidationPipe(RoomUpdateSchema)) body: RoomUpdateDTO,
  ) {
    return this.roomsService.update(id, userId, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @UserId() userId: number) {
    return this.roomsService.remove(id, userId);
  }

  @Post(':id/participants/:userId')
  @HttpCode(503)
  @CheckAbilities(['invite', 'Room'])
  addParticipant(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.roomsService.addParticipant(+id, +userId);
  }

  // Serves both self-leave and moderator/owner-kick — the coarse
  // decorator can't pick a single action, since which one applies depends
  // on whether :userId is the caller or someone else. Needs a fine-grained
  // check in the service once implemented:
  // ForbiddenError.from(ability).throwUnlessCan(
  //   userId === callerId ? 'leave' : 'kick',
  //   subject('Room', room),
  // );
  @Delete(':id/participants/:userId')
  @HttpCode(503)
  removeParticipant(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.roomsService.removeParticipant(+id, +userId);
  }

  @Get(':id/messages')
  @HttpCode(503)
  @CheckAbilities(['read', 'Message'])
  getMessages(@Param('id', ParseIntPipe) id: number) {
    return this.roomsService.getMessages(+id);
  }

  @Post(':id/messages')
  @HttpCode(503)
  @CheckAbilities(['create', 'Message'])
  createMessage(@Param('id', ParseIntPipe) id: number) {
    return this.roomsService.createMessage(+id);
  }

  @Delete(':id/messages/:messageId')
  @HttpCode(503)
  @CheckAbilities(['delete', 'Message'])
  removeMessage(
    @Param('id', ParseIntPipe) id: number,
    @Param('messageId', ParseIntPipe) messageId: number,
  ) {
    return this.roomsService.removeMessage(+id, +messageId);
  }
}
