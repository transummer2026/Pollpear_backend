import {
  Controller,
  Post,
  Patch,
  Param,
  Delete,
  HttpCode,
  ParseIntPipe,
} from '@nestjs/common';
import { PollsService } from './polls.service';
import { CheckAbilities } from 'src/common/decorators/check-ability.decorator';
import { UserId } from 'src/common/decorators/user-id.decorator';

@Controller('polls')
export class PollsController {
  constructor(private readonly pollsService: PollsService) {}

  @Post('new')
  @CheckAbilities(['create', 'Poll'])
  @HttpCode(503)
  create() {
    return this.pollsService.create();
  }

  @Patch(':id')
  @HttpCode(503)
  @CheckAbilities(['update', 'Poll'])
  update(@UserId() userId: number, @Param('id') id: string) {
    return this.pollsService.update(userId, +id);
  }

  @Delete(':id')
  @CheckAbilities(['delete', 'Poll'])
  @HttpCode(503)
  remove(@Param('id') id: string) {
    return this.pollsService.remove(+id);
  }

  @Post(':id/report')
  @CheckAbilities(['report', 'Poll'])
  @HttpCode(503)
  report(@Param('id', ParseIntPipe) id: number) {
    return this.pollsService.report(+id);
  }

  @Post(':id/options/:optionId/report')
  @CheckAbilities(['report', 'PollOption'])
  @HttpCode(503)
  reportOption(
    @Param('id', ParseIntPipe) id: number,
    @Param('optionId', ParseIntPipe) optionId: number,
  ) {
    return this.pollsService.reportOption(+id, +optionId);
  }

  // moderator Guard green
  @Delete(':id/options/:optionId')
  @CheckAbilities(['delete', 'PollOption'])
  @HttpCode(503)
  removeOption(
    @Param('id', ParseIntPipe) id: number,
    @Param('optionId', ParseIntPipe) optionId: number,
  ) {
    return this.pollsService.removeOption(+id, +optionId);
  }

  //routes will dissapear because later we will use wbesockets
  @Post(':id/vote')
  @CheckAbilities(['create', 'PollVote'])
  @HttpCode(503)
  createVote(@Param('id', ParseIntPipe) id: number) {
    return this.pollsService.createVote(+id);
  }

  @Patch(':id/vote')
  @CheckAbilities(['update', 'PollVote'])
  @HttpCode(503)
  updateVote(@Param('id', ParseIntPipe) id: number) {
    return this.pollsService.updateVote(+id);
  }

  @Delete(':id/vote')
  @CheckAbilities(['delete', 'PollVote'])
  @HttpCode(503)
  removeVote(@Param('id', ParseIntPipe) id: number) {
    return this.pollsService.removeVote(+id);
  }

  @Post(':id/vote/report')
  @CheckAbilities(['report', 'PollVote'])
  @HttpCode(503)
  reportVote(@Param('id', ParseIntPipe) id: number) {
    return this.pollsService.reportVote(+id);
  }
}
