import { Controller, Get, Post, Patch, Param, Delete, HttpCode, ParseIntPipe } from '@nestjs/common';
import { PollsService } from './polls.service';

@Controller('polls')
export class PollsController {
  constructor(private readonly pollsService: PollsService) {}

  @Post('new')
  @HttpCode(503)
  create() {
    return this.pollsService.create();
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: string) {
    return this.pollsService.update(+id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: string) {
    return this.pollsService.remove(+id);
  }

  @Post(':id/report')
  @HttpCode(503)
  reportPoll(@Param('id', ParseIntPipe) id: string) {
    return this.pollsService.reportPoll(+id);
  }

  @Post(':id/options/:optionId/report')
  @HttpCode(503)
  reportPollOption(
    @Param('id', ParseIntPipe) id: string,
    @Param('optionId', ParseIntPipe) optionId: string,
  ) {
    return this.pollsService.reportPollOption(+id, +optionId);
  }

  // moderator Guard green
  @Delete(':id/options/:optionId/report')
  @HttpCode(503)
  removePollOption(
    @Param('id', ParseIntPipe) id: string,
    @Param('optionId', ParseIntPipe) optionId: string,
  ) {
    return this.pollsService.removePollOption(+id, +optionId);
  }

  @Get()
  findAll() {
    return this.pollsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pollsService.findOne(+id);
  }


}
