import { Controller, Get, HttpCode, ParseIntPipe, Param } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
