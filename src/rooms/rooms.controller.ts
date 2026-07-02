import { Controller, Post, Get, Patch, Param, Delete, ParseIntPipe, HttpCode } from '@nestjs/common';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post('new')
  @HttpCode(503)
  create() {
    return this.roomsService.create();
  }

  @Patch(':id')
  @HttpCode(503)
  update(@Param('id', ParseIntPipe) id: string) {
    return this.roomsService.update(+id);
  }

  @Delete(':id')
  @HttpCode(503)
  remove(@Param('id') id: string) {
    return this.roomsService.remove(+id);
  }

  @Post(':id/participants/:userId')
  @HttpCode(503)
  addParticipant(
    @Param('id', ParseIntPipe) id: string,
    @Param('userId', ParseIntPipe) userId: string,
  ) {
    return this.roomsService.addParticipant(+id, +userId);
  }

  @Delete(':id/participants/:userId')
  @HttpCode(503)
  removeParticipant(
    @Param('id', ParseIntPipe) id: string,
    @Param('userId', ParseIntPipe) userId: string,
  ) {
    return this.roomsService.removeParticipant(+id, +userId);
  }

  @Get(':id/messages')
  @HttpCode(503)
  getMessages(@Param('id', ParseIntPipe) id: string) {
    return this.roomsService.getMessages(+id);
  }

  @Post(':id/messages')
  @HttpCode(503)
  createMessage(@Param('id', ParseIntPipe) id: string) {
    return this.roomsService.createMessage(+id);
  }

  @Delete(':id/messages/:messageId')
  @HttpCode(503)
  removeMessage(
    @Param('id', ParseIntPipe) id: string,
    @Param('messageId', ParseIntPipe) messageId: string,
  ) {
    return this.roomsService.removeMessage(+id, +messageId);
  }
}
