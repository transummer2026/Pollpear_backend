import { Controller, Post, Get, Patch, Param, Delete, ParseIntPipe, HttpCode } from '@nestjs/common';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post('new')
  create() {
    return this.roomsService.create();
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: string) {
    return this.roomsService.update(+id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.roomsService.remove(+id);
  }

  @Post(':id/participants/:userId')
  @HttpCode(503)
  addUserToRoom(
    @Param('id', ParseIntPipe) id: string,
    @Param('userId', ParseIntPipe) userId: string,
  ) {
    return this.roomsService.addUserToRoom(+id, +userId);
  }

  @Delete(':id/participants/:userId')
  @HttpCode(503)
  removeUserFromRoom(
    @Param('id', ParseIntPipe) id: string,
    @Param('userId', ParseIntPipe) userId: string,
  ) {
    return this.roomsService.removeUserFromRoom(+id, +userId);
  }

  @Get(':id/messages')
  @HttpCode(503)
  getMessagesFromRoom(@Param('id', ParseIntPipe) id: string) {
    return this.roomsService.getMessagesFromRoom(+id);
  }

  @Post(':id/messages')
  @HttpCode(503)
  createMessage(@Param('id', ParseIntPipe) id: string) {
    return this.roomsService.createMessage(+id);
  }
}
