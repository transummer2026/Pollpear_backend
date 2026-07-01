import { Controller, Get, Param, HttpCode, ParseIntPipe } from '@nestjs/common';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get('rooms')
  @HttpCode(503)
  findAllRooms() {
    return this.roomsService.findAllRooms();
  }

  @Get('rooms/:id')
  @HttpCode(503)
  findOneRoom(@Param('id', ParseIntPipe) id: number) {
    return this.roomsService.findOneRoom(id);
  }
}
