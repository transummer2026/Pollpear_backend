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
  Query,
} from '@nestjs/common';
import { PollsService } from './polls.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { User } from 'src/generated/prisma/client';
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
import { Logger } from '@nestjs/common';

@Controller('polls')
export class PollsController {
  constructor(
    private readonly pollsService: PollsService,
    private readonly votesService: VotesService,
    private logger: Logger,
  ) {}

  @Post('new')
  @CheckAbilities(['create', 'Poll'])
  create(
    @CurrentUser() viewer: User,
    @Body(new ZodValidationPipe(PollCreateSchema)) body: PollCreateDTO,
  ) {
    return this.pollsService.create(viewer, body);
  }

  @Get(':id')
  @CheckAbilities(['read', 'Poll'])
  findMeOnePoll(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() viewer: User,
  ) {
    return this.pollsService.findMeOnePoll(id, viewer);
  }

  @Get()
  @CheckAbilities(['read', 'Poll'])
  findManyPolls(
    @CurrentUser() viewer: User,
    @Query('userId') targetUserId?: string,
  ) {
    if (targetUserId) {
      this.logger.debug('targetId is captured in the url');
      return this.pollsService.findUsersManyPolls(viewer, +targetUserId);
    }
    this.logger.debug('Only userId is captured in the url');
    return this.pollsService.findMeManyPolls(viewer);
  }

  @Patch(':id')
  @CheckAbilities(['update', 'Poll'])
  update(
    @CurrentUser() viewer: User,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(PollUpdateSchema)) body: PollUpdateDTO,
  ) {
    return this.pollsService.update(id, viewer, body);
  }

  @Delete(':id')
  @CheckAbilities(['delete', 'Poll'])
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() viewer: User) {
    return this.pollsService.remove(id, viewer);
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
  @CheckAbilities(['read', 'Vote'])
  findOneVote(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() viewer: User,
  ) {
    return this.votesService.findOneVote(id, viewer);
  }

  @Post(':id/vote')
  @CheckAbilities(['create', 'Vote'])
  createVote(
    @Param('id', ParseIntPipe) pollId: number,
    @CurrentUser() viewer: User,
    @Body(new ZodValidationPipe(VoteCreateSchema)) body: VoteCreateDTO,
  ) {
    return this.votesService.createVote(pollId, viewer, body);
  }

  @Patch(':id/vote')
  @CheckAbilities(['update', 'Vote'])
  updateVote(
    @Param('id', ParseIntPipe) pollId: number,
    @CurrentUser() viewer: User,
    @Body(new ZodValidationPipe(VoteUpdateSchema)) body: VoteUpdateDTO,
  ) {
    return this.votesService.updateVote(pollId, viewer, body);
  }

  @Delete(':id/vote')
  @CheckAbilities(['delete', 'Vote'])
  removeVote(
    @Param('id', ParseIntPipe) pollId: number,
    @CurrentUser() viewer: User,
  ) {
    return this.votesService.deleteVote(pollId, viewer);
  }

  @Post(':id/vote/report')
  @CheckAbilities(['report', 'Vote'])
  @HttpCode(503)
  reportVote(@Param('id', ParseIntPipe) id: number) {
    return this.votesService.reportVote(id);
  }
}
