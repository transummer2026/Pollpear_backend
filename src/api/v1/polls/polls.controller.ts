import { Controller, Get, Param, ParseIntPipe, HttpCode } from '@nestjs/common';
import { PollsService } from './polls.service';

@Controller('polls')
export class PollsController {
  constructor(private readonly pollsService: PollsService) {}

  @Get()
  @HttpCode(503)
  findAllPolls() {
    return this.pollsService.findAllPolls();
  }

  @Get(':id')
  @HttpCode(503)
  findOnePoll(@Param('id', ParseIntPipe) id: number) {
    return this.pollsService.findOnePoll(+id);
  }

  @Get(':id/results')
  @HttpCode(503)
  findPollResults(@Param('id', ParseIntPipe) id: number) {
    return this.pollsService.findPollResults(+id);
  }
}
