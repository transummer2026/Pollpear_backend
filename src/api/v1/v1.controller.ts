import { Controller, Get, Param, ParseIntPipe, HttpCode } from '@nestjs/common';
import { V1Service } from './v1.service';

@Controller('api/v1')
export class V1Controller {
  constructor(private readonly v1Service: V1Service) {}

  @Get('users')
  @HttpCode(503)
  findAllUsers() {
    return this.v1Service.findAllUsers();
  }

  @Get('users/:id')
  @HttpCode(503)
  findOneUser(@Param('id', ParseIntPipe) id: number) {
    return this.v1Service.findOneUser(+id);
  }

  @Get('polls')
  @HttpCode(503)
  findAllPolls() {
    return this.v1Service.findAllPolls();
  }

  @Get('polls/:id')
  @HttpCode(503)
  findOnePoll(@Param('id', ParseIntPipe) id: number) {
    return this.v1Service.findOnePoll(id);
  }

  @Get('polls/:id/results')
  @HttpCode(503)
  findPollResults(@Param('id', ParseIntPipe) id: number) {
    return this.v1Service.findPollResults(+id);
  }

  @Get('rooms')
  @HttpCode(503)
  findAllRooms() {
    return this.v1Service.findAllRooms();
  }

  @Get('rooms/:id')
  @HttpCode(503)
  findOneRoom(@Param('id', ParseIntPipe) id: number) {
    return this.v1Service.findOneRoom(id);
  }

  @Get('hashtags')
  @HttpCode(503)
  findAllHashtags() {
    return this.v1Service.findAllHashtags();
  }

  @Get('hashtags/:id')
  @HttpCode(503)
  findOneHashtag(@Param('id', ParseIntPipe) id: number) {
    return this.v1Service.findOneHashtag(id);
  }
}
