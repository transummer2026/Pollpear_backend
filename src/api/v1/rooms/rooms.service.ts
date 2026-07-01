import { Injectable } from '@nestjs/common';

@Injectable()
export class RoomsService {
  findAllRooms() {
    return 'Get all rooms - not implemented';
  }

  findOneRoom(id: number) {
    return `Get room ${id} - not implemented`;
  }
}
