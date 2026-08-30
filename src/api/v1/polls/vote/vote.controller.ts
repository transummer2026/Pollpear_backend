import { Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiPollVoteService } from './vote.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CheckAbilities } from 'src/common/decorators/check-ability.decorator';
import type { User } from 'src/generated/prisma/client';
import { IdParam, ValidatedBody } from '../../common/params';
import { ApiGuardDocs, ApiIdParamDocs } from '../../common/api-docs';
import { toOpenApi } from '../../common/openapi';
import {
  ApiVoteCastSchema,
  ApiVoteChangeSchema,
  ApiVoteSchema,
  type ApiVoteCastDTO,
  type ApiVoteChangeDTO,
} from '../../common/schemas/api-votes.schema';

@ApiTags('polls')
@ApiGuardDocs()
@Controller('v1/polls/:id/vote')
export class ApiPollVoteController {
  constructor(private readonly voteService: ApiPollVoteService) {}

  @Get()
  @CheckAbilities(['read', 'Vote'])
  @ApiOperation({
    summary: 'The vote the caller cast in this poll',
    description:
      'Only your own vote is ever returned. A poll you may not see, and a poll you have not voted in, both answer 404. A poll that is over still shows how you voted.',
  })
  @ApiOkResponse({ schema: toOpenApi(ApiVoteSchema) })
  @ApiNotFoundResponse({ description: 'No such poll, or you have not voted.' })
  @ApiIdParamDocs('Poll the vote belongs to.')
  findMyVote(@IdParam() id: number, @CurrentUser() caller: User) {
    return this.voteService.findMyVote(id, caller);
  }

  @Post()
  @CheckAbilities(['create', 'Vote'])
  @ApiOperation({
    summary: 'Vote in a poll',
    description:
      'The ballot names the poll type it answers, and is refused when it does not match. Options must belong to the poll: exactly one for a single choice or a slider, at least one for a multiple choice. A slider vote carries its value in freeField. The first vote on a pending poll publishes it. The ballot is the API contract, not the one the web app posts: a choice vote carries optionIds, and a slider carries freeField as a number.',
  })
  @ApiBody({ schema: toOpenApi(ApiVoteCastSchema) })
  @ApiCreatedResponse({ schema: toOpenApi(ApiVoteSchema) })
  @ApiBadRequestResponse({
    description: 'Wrong poll type, or an option that is not the polls own.',
  })
  @ApiForbiddenResponse({
    description: 'Banned account, or a poll the caller may not vote in.',
  })
  @ApiNotFoundResponse({ description: 'No such poll, or not visible to you.' })
  @ApiConflictResponse({
    description: 'The poll no longer takes votes, or you already voted.',
  })
  @ApiIdParamDocs('Poll to vote in.')
  castVote(
    @IdParam() id: number,
    @ValidatedBody(ApiVoteCastSchema) ballot: ApiVoteCastDTO,
    @CurrentUser() caller: User,
  ) {
    return this.voteService.castVote(id, ballot, caller);
  }

  @Patch()
  @CheckAbilities(['update', 'Vote'])
  @ApiOperation({
    summary: 'Change the vote already cast',
    description:
      'Send only what changes: an omitted field keeps its value, and the options sent replace the previous selection whole. Only a running poll takes a change, and a poll created without allowChangeVote refuses one for everybody.',
  })
  @ApiBody({ schema: toOpenApi(ApiVoteChangeSchema) })
  @ApiOkResponse({ schema: toOpenApi(ApiVoteSchema) })
  @ApiBadRequestResponse({
    description: 'Wrong poll type, or an option that is not the polls own.',
  })
  @ApiForbiddenResponse({ description: 'Banned account.' })
  @ApiNotFoundResponse({ description: 'No such poll, or you have not voted.' })
  @ApiConflictResponse({
    description: 'The poll is not running, or forbids changing a vote.',
  })
  @ApiIdParamDocs('Poll the vote belongs to.')
  changeVote(
    @IdParam() id: number,
    @ValidatedBody(ApiVoteChangeSchema) ballot: ApiVoteChangeDTO,
    @CurrentUser() caller: User,
  ) {
    return this.voteService.changeVote(id, ballot, caller);
  }

  @Delete()
  @HttpCode(204)
  @CheckAbilities(['delete', 'Vote'])
  @ApiOperation({
    summary: 'Withdraw the vote already cast',
    description:
      'The vote stops counting in the results. Only a running poll takes a withdrawal, and voting again afterwards is allowed while it runs.',
  })
  @ApiNoContentResponse({ description: 'Vote withdrawn.' })
  @ApiForbiddenResponse({ description: 'Banned account.' })
  @ApiNotFoundResponse({ description: 'No such poll, or you have not voted.' })
  @ApiConflictResponse({ description: 'The poll is not running.' })
  @ApiIdParamDocs('Poll the vote belongs to.')
  withdrawVote(@IdParam() id: number, @CurrentUser() caller: User) {
    return this.voteService.withdrawVote(id, caller);
  }
}
