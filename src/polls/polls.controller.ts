import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Delete,
  HttpCode,
  ParseIntPipe,
  Body,
} from '@nestjs/common';
import { PollsService } from './polls.service';
import { UserId } from 'src/common/decorators/user-id.decorator';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import {
  type PollCreateDTO,
  PollCreateSchema,
  type PollUpdateDTO,
  PollUpdateSchema,
} from 'Pollpear_shared/src/schemas/polls.schema';
import { CheckAbilities } from 'src/common/decorators/check-ability.decorator';
import {
  type VoteCreateDTO,
  VoteCreateSchema,
  type VoteUpdateDTO,
  VoteUpdateSchema,
} from 'Pollpear_shared/src/schemas/vote.schema';
import { VotesService } from 'src/votes/votes.service';

@Controller('polls')
export class PollsController {
  constructor(
    private readonly pollsService: PollsService,
    private readonly votesService: VotesService,
  ) {}

  @Post('new')
  @CheckAbilities(['create', 'Poll'])
  create(
    @UserId() userId: number,
    @Body(new ZodValidationPipe(PollCreateSchema)) body: PollCreateDTO,
  ) {
    return this.pollsService.create(userId, body);
  }

  @Get(':id')
  @CheckAbilities(['read', 'Poll'])
  findMeOnePoll(
    @Param('id', ParseIntPipe) id: number,
    @UserId() userId: number,
  ) {
    return this.pollsService.findMeOnePoll(id, userId);
  }

  @Get()
  @CheckAbilities(['read', 'Poll'])
  findMeManyPolls(@UserId() userId: number) {
    return this.pollsService.findMeManyPolls(userId);
  }

  @Patch(':id')
  @CheckAbilities(['update', 'Poll'])
  update(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(PollUpdateSchema)) body: PollUpdateDTO,
  ) {
    return this.pollsService.update(id, userId, body);
  }

  @Delete(':id')
  @CheckAbilities(['delete', 'Poll'])
  remove(@Param('id', ParseIntPipe) id: number, @UserId() userId: number) {
    return this.pollsService.remove(id, userId);
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
  @Get(':id/vote:id')
  @CheckAbilities(['read', 'PollVote'])
  findOneVote(@Param('id', ParseIntPipe) id: number, @UserId() userId: number) {
    return this.votesService.findOneVote(id, userId);
  }

  @Post(':id/vote')
  @CheckAbilities(['create', 'PollVote'])
  createVote(
    @Param('id', ParseIntPipe) pollId: number,
    @UserId() userId: number,
    @Body(new ZodValidationPipe(VoteCreateSchema)) body: VoteCreateDTO,
  ) {
    return this.votesService.createVote(pollId, userId, body);
  }

  @Patch(':id/vote')
  @CheckAbilities(['update', 'PollVote'])
  updateVote(
    @Param('id', ParseIntPipe) pollId: number,
    @UserId() userId: number,
    @Body(new ZodValidationPipe(VoteUpdateSchema)) body: VoteUpdateDTO,
  ) {
    return this.votesService.updateVote(pollId, userId, body);
  }

  @Delete(':id/vote')
  @CheckAbilities(['delete', 'PollVote'])
  removeVote(
    @Param('id', ParseIntPipe) pollId: number,
    @UserId() userId: number,
  ) {
    return this.votesService.deleteVote(pollId, userId);
  }

  @Post(':id/vote/report')
  @CheckAbilities(['report', 'PollVote'])
  @HttpCode(503)
  reportVote(@Param('id', ParseIntPipe) id: number) {
    return this.votesService.reportVote(id);
  }
}
