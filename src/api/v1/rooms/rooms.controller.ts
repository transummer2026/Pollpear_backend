import { Controller, Get, Param, HttpCode, ParseIntPipe } from '@nestjs/common';
import { ApiRoomsService } from './rooms.service';

@Controller('v1/rooms')
export class ApiRoomsController {
  constructor(private readonly roomsService: ApiRoomsService) {}

  @Get()
  @HttpCode(503)
  findAllRooms() {
    return this.roomsService.findAllRooms();
  }

  @Get(':id')
  @HttpCode(503)
  findOneRoom(@Param('id', ParseIntPipe) id: number) {
    return this.roomsService.findOneRoom(id);
  }
}
