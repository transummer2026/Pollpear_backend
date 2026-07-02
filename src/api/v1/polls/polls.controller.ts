import { Controller, Get, Param, ParseIntPipe, HttpCode } from '@nestjs/common';
import { ApiPollsService } from './polls.service';

@Controller('api/v1/polls')
export class ApiPollsController {
  constructor(private readonly pollsService: ApiPollsService) {}

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
