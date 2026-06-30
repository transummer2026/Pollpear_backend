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
  deletePollVote(@Param('id', ParseIntPipe) id: string) {
    return this.pollsService.deletePollVote(+id);
  }

  @Post(':id/vote/report')
  @HttpCode(503)
  reportPollVote(@Param('id', ParseIntPipe) id: string) {
    return this.pollsService.reportPollVote(+id);
  }
}
