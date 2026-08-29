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
import { ApiPollsService } from './polls.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CheckAbilities } from 'src/common/decorators/check-ability.decorator';
import type { User } from 'src/generated/prisma/client';
import { IdParam, ValidatedBody, ValidatedQuery } from '../common/params';
import {
  ApiGuardDocs,
  ApiFilterDocs,
  ApiIdParamDocs,
  ApiPageQueryDocs,
} from '../common/api-docs';
import { toOpenApi, toOpenApiOneOf } from '../common/openapi';
import {
  ApiPollChoiceResultsSchema,
  ApiPollCreateSchema,
  ApiPollFilterSchema,
  ApiPollPageSchema,
  ApiPollQuerySchema,
  ApiPollSchema,
  ApiPollSliderResultsSchema,
  ApiPollUpdateSchema,
  type ApiPollCreateDTO,
  type ApiPollQueryDTO,
  type ApiPollUpdateDTO,
} from '../common/schemas/api-polls.schema';

@ApiTags('polls')
@ApiGuardDocs()
@Controller('v1/polls')
export class ApiPollsController {
  constructor(private readonly pollsService: ApiPollsService) {}

  @Get()
  @CheckAbilities(['read', 'Poll'])
  @ApiOperation({
    summary: 'List the polls the caller may see',
    description:
      'Public polls, your own whatever their state, and those of the rooms you belong to. A moderator sees every poll, an admin the deleted ones too. Newest first: pages are ordered by descending id.',
  })
  @ApiPageQueryDocs()
  @ApiFilterDocs(ApiPollFilterSchema)
  @ApiOkResponse({ schema: toOpenApi(ApiPollPageSchema) })
  @ApiBadRequestResponse({
    description: 'Unknown parameter, invalid filter, or page past the last.',
  })
  findAllPolls(
    @ValidatedQuery(ApiPollQuerySchema) query: ApiPollQueryDTO,
    @CurrentUser() caller: User,
  ) {
    return this.pollsService.findAllPolls(query, caller);
  }

  @Post()
  @CheckAbilities(['create', 'Poll'])
  @ApiOperation({
    summary: 'Create a poll',
    description:
      'The author is the key owner, never the body. A new poll is always pending: options are fixed at creation, two to twenty for a choice poll, exactly one carrying the labels for a slider, none for a free field.',
  })
  @ApiBody({ schema: toOpenApi(ApiPollCreateSchema) })
  @ApiCreatedResponse({ schema: toOpenApi(ApiPollSchema) })
  @ApiBadRequestResponse({
    description: 'Unknown field, invalid value, or wrong option count.',
  })
  @ApiForbiddenResponse({
    description:
      'Banned account, or a room was named the caller does not belong to.',
  })
  createPoll(
    @ValidatedBody(ApiPollCreateSchema) body: ApiPollCreateDTO,
    @CurrentUser() caller: User,
  ) {
    return this.pollsService.createPoll(body, caller);
  }

  @Get(':id')
  @CheckAbilities(['read', 'Poll'])
  @ApiOperation({
    summary: 'One poll and its options',
    description:
      'Options come sorted, deleted ones left out. A poll the caller may not see answers 404, like a missing one. An anonymous poll never names its author, except to the author.',
  })
  @ApiOkResponse({ schema: toOpenApi(ApiPollSchema) })
  @ApiNotFoundResponse({ description: 'No such poll, or not visible to you.' })
  @ApiIdParamDocs('Poll to read.')
  findOnePoll(@IdParam() id: number, @CurrentUser() caller: User) {
    return this.pollsService.findOnePoll(id, caller);
  }

  @Get(':id/results')
  @CheckAbilities(['read', 'Poll'])
  @ApiOperation({
    summary: 'The tally of one poll',
    description:
      'Everything here counts voters, never ballots. On a multiple choice poll one voter ticks several options, so the option figures add up to more than the poll total, and an option nobody picked is still listed at zero. A slider answers the spread of the values sent, ordered as a scale, capped at the hundred most answered: past that truncated turns true and average, min and max are withheld rather than computed on a part of the answers. They are withheld too when an answer does not read as a number. No voter is ever named, whether or not the poll is anonymous.',
  })
  @ApiOkResponse({
    schema: toOpenApiOneOf(
      ApiPollChoiceResultsSchema,
      ApiPollSliderResultsSchema,
    ),
    description:
      'The choice shape for a choice poll, the slider one for a slider.',
  })
  @ApiNotFoundResponse({ description: 'No such poll, or not visible to you.' })
  @ApiIdParamDocs('Poll to tally.')
  findPollResults(@IdParam() id: number, @CurrentUser() caller: User) {
    return this.pollsService.findPollResults(id, caller);
  }

  @Patch(':id')
  @CheckAbilities(['update', 'Poll'])
  @ApiOperation({
    summary: 'Edit a poll that has not started',
    description:
      'The author only, and only while the poll is pending: once it is published the rules of a vote in progress do not change.',
  })
  @ApiBody({ schema: toOpenApi(ApiPollUpdateSchema) })
  @ApiOkResponse({ schema: toOpenApi(ApiPollSchema) })
  @ApiBadRequestResponse({
    description: 'Unknown field, invalid value, or empty body.',
  })
  @ApiForbiddenResponse({
    description: 'Banned account, or not your poll.',
  })
  @ApiConflictResponse({ description: 'The poll is no longer pending.' })
  @ApiNotFoundResponse({ description: 'No such poll, or not visible to you.' })
  @ApiIdParamDocs('Poll to edit.')
  updatePoll(
    @IdParam() id: number,
    @ValidatedBody(ApiPollUpdateSchema) body: ApiPollUpdateDTO,
    @CurrentUser() caller: User,
  ) {
    return this.pollsService.updatePoll(id, body, caller);
  }

  @Delete(':id')
  @HttpCode(204)
  @CheckAbilities(['delete', 'Poll'])
  @ApiOperation({
    summary: 'Delete a poll that has not started',
    description:
      'Soft delete. The author or an admin, and only while the poll is pending: a poll people have voted on is closed, not erased.',
  })
  @ApiNoContentResponse({ description: 'Poll deleted.' })
  @ApiForbiddenResponse({
    description: 'Banned account, or not your poll.',
  })
  @ApiConflictResponse({ description: 'The poll is no longer pending.' })
  @ApiNotFoundResponse({ description: 'No such poll, or not visible to you.' })
  @ApiIdParamDocs('Poll to delete.')
  removePoll(@IdParam() id: number, @CurrentUser() caller: User) {
    return this.pollsService.removePoll(id, caller);
  }
}
