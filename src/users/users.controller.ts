import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post(':id/report')
  @HttpCode(503)
  report(@Param('id', ParseIntPipe) id: string) {
    return this.usersService.report(+id);
  }

  @Post(':id/block')
  @HttpCode(503)
  block(@Param('id', ParseIntPipe) id: string) {
    return this.usersService.block(+id);
  }

  @Post(':id/friendship')
  @HttpCode(503)
  createFriendRequest(@Param('id', ParseIntPipe) id: string) {
    return this.usersService.createFriendRequest(+id);
  }

  // respond to friend request to update the result of the friendship
  @Patch(':id/friendship')
  @HttpCode(503)
  updateFriendRequest(@Param('id', ParseIntPipe) id: string) {
    return this.usersService.updateFriendRequest(+id);
  }

  @Delete(':id/friendship')
  @HttpCode(503)
  removeFriendship(@Param('id', ParseIntPipe) id: string) {
    return this.usersService.removeFriendship(+id);
  }

  // add Guard for moderator from here on (green arrows on sequence diagram)
  @Post(':id/ban')
  @HttpCode(503)
  ban(@Param('id', ParseIntPipe) id: string) {
    return this.usersService.ban(+id);
  }

  @Patch(':id/ban')
  @HttpCode(503)
  updateBan(@Param('id', ParseIntPipe) id: string) {
    return this.usersService.updateBan(+id);
  }

  // add Guard for admin from here on (red arrows on sequence diagram)
  @Patch(':id')
  @HttpCode(503)
  update(@Param('id', ParseIntPipe) id: string, @Body() body: any) {
    console.log(body);
    return this.usersService.updateBan(+id);
  }

  @Delete(':id')
  @HttpCode(503)
  remove(@Param('id', ParseIntPipe) id: string) {
    return this.usersService.remove(+id);
  }
}
