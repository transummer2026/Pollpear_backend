import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  HttpCode,
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CheckAbilities } from 'src/common/decorators/check-ability.decorator';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post('new')
  @HttpCode(503)
  @CheckAbilities(['create', 'Room'])
  create() {
    return this.roomsService.create();
  }

  @Patch(':id')
  @HttpCode(503)
  @CheckAbilities(['update', 'Room'])
  update(@Param('id', ParseIntPipe) id: number) {
    return this.roomsService.update(+id);
  }

  @Delete(':id')
  @HttpCode(503)
  @CheckAbilities(['delete', 'Room'])
  remove(@Param('id') id: string) {
    return this.roomsService.remove(+id);
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
