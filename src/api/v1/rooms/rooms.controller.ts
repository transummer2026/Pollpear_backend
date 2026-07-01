import { Controller, Get, Param, HttpCode, ParseIntPipe } from '@nestjs/common';
import { ApiRoomsService } from './rooms.service';

@Controller('rooms')
export class ApiRoomsController {
  constructor(private readonly roomsService: ApiRoomsService) {}

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
