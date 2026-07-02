import { Injectable } from '@nestjs/common';

@Injectable()
export class ApiUsersService {
  findAllUsers() {
    return 'Get all users - not implemented';
  }

  findOneUser(id: number) {
    return `Get user ${id} - not implemented`;
  }
}
