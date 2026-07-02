import { Controller, Post, Patch, Param, Delete, HttpCode, ParseIntPipe } from '@nestjs/common';
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
  @HttpCode(503)
  update(@Param('id') id: string) {
    return this.pollsService.update(+id);
  }

  @Delete(':id')
  @HttpCode(503)
  remove(@Param('id') id: string) {
    return this.pollsService.remove(+id);
  }

  @Post(':id/report')
  @HttpCode(503)
  report(@Param('id', ParseIntPipe) id: string) {
    return this.pollsService.report(+id);
  }

  @Post(':id/options/:optionId/report')
  @HttpCode(503)
  reportOption(
    @Param('id', ParseIntPipe) id: string,
    @Param('optionId', ParseIntPipe) optionId: string,
  ) {
    return this.pollsService.reportOption(+id, +optionId);
  }

  // moderator Guard green
  @Delete(':id/options/:optionId')
  @HttpCode(503)
  removeOption(
    @Param('id', ParseIntPipe) id: string,
    @Param('optionId', ParseIntPipe) optionId: string,
  ) {
    return this.pollsService.removeOption(+id, +optionId);
  }

  //routes will dissapear because later we will use wbesockets
  @Post(':id/vote')
  @HttpCode(503)
  createVote(@Param('id', ParseIntPipe) id: string) {
    return this.pollsService.createVote(+id);
  }

  @Patch(':id/vote')
  @HttpCode(503)
  updateVote(@Param('id', ParseIntPipe) id: string) {
    return this.pollsService.updateVote(+id);
  }

  @Delete(':id/vote')
  @HttpCode(503)
  removeVote(@Param('id', ParseIntPipe) id: string) {
    return this.pollsService.removeVote(+id);
  }

  @Post(':id/vote/report')
  @HttpCode(503)
  reportVote(@Param('id', ParseIntPipe) id: string) {
    return this.pollsService.reportVote(+id);
  }
}
