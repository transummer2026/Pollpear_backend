import { Controller, Get, HttpCode, ParseIntPipe, Param } from '@nestjs/common';
import { ApiUsersService } from './users.service';

@Controller('api/v1/users')
export class ApiUsersController {
  constructor(private readonly usersService: ApiUsersService) {}

  @Get()
  @HttpCode(503)
  findAllUsers() {
    return this.usersService.findAllUsers();
  }

  @Get(':id')
  @HttpCode(503)
  findOneUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOneUser(+id);
  }
}
