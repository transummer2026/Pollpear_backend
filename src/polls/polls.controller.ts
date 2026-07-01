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
  update(@Param('id', ParseIntPipe) id: string) {
    return this.pollsService.update(+id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: string) {
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
  @Delete(':id/options/:optionId/report')
  @HttpCode(503)
  removeOption(
    @Param('id', ParseIntPipe) id: string,
    @Param('optionId', ParseIntPipe) optionId: string,
  ) {
    return this.pollsService.removeOption(+id, +optionId);
  }

  //routes will dissapear because later we will use wbesockets
  @Post(':id/votes')
  @HttpCode(503)
  createVote(@Param('id', ParseIntPipe) id: string) {
    return this.pollsService.createVote(+id);
  }

  //TODO: check this with the voteId as route is not in the sequence diagram
  // @Patch(':id/votes/:voteId')
  // @HttpCode(503)
  // updateVote(@Param('id', ParseIntPipe) id: string) {
  //   return this.pollsService.updateVote(+id);
  // }

  //admin guard red
  @Delete(':id/vote')
  @HttpCode(503)
  removeVote(@Param('id', ParseIntPipe) id: string) {
    return this.pollsService.removeVote(+id);
  }

  @Post(':id/vote/report')
  @HttpCode(503)
  reportVote(@Param('id', ParseIntPipe) id: string) {
    return this.pollsService.reportPollVote(+id);
  }
}
