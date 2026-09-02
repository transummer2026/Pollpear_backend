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
import { ApiFriendshipsService } from './friendships.service';
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
import { toOpenApi } from '../common/openapi';
import {
  ApiFriendshipCreateSchema,
  ApiFriendshipFilterSchema,
  ApiFriendshipPageSchema,
  ApiFriendshipQuerySchema,
  ApiFriendshipSchema,
  ApiFriendshipUpdateSchema,
  type ApiFriendshipCreateDTO,
  type ApiFriendshipQueryDTO,
  type ApiFriendshipUpdateDTO,
} from '../common/schemas/api-friendships.schema';

@ApiTags('friendships')
@ApiGuardDocs()
@Controller('v1/friendships')
export class ApiFriendshipsController {
  constructor(private readonly friendshipsService: ApiFriendshipsService) {}

  @Get()
  @CheckAbilities(['read', 'Friendship'])
  @ApiOperation({
    summary: 'List the friendships the caller may see',
    description:
      'Your own, whatever their state, and the accepted ones between two accounts that are neither private nor blocking you. Newest first: pages are ordered by descending id.',
  })
  @ApiPageQueryDocs()
  @ApiFilterDocs(ApiFriendshipFilterSchema)
  @ApiOkResponse({ schema: toOpenApi(ApiFriendshipPageSchema) })
  @ApiBadRequestResponse({
    description: 'Unknown parameter, invalid filter, or page past the last.',
  })
  findAllFriendships(
    @ValidatedQuery(ApiFriendshipQuerySchema) query: ApiFriendshipQueryDTO,
    @CurrentUser() caller: User,
  ) {
    return this.friendshipsService.findAllFriendships(query, caller);
  }

  @Post()
  @CheckAbilities(['create', 'Friendship'])
  @ApiOperation({
    summary: 'Ask someone to be friends',
    description:
      'The requester is the key owner, never the body. Asking someone who already asked you accepts their request instead of opening a second one, so two people can never hold two facing requests. Asking again after a refusal reopens the same one.',
  })
  @ApiBody({ schema: toOpenApi(ApiFriendshipCreateSchema) })
  @ApiCreatedResponse({ schema: toOpenApi(ApiFriendshipSchema) })
  @ApiBadRequestResponse({
    description: 'Unknown field, invalid value, or yourself as the addressee.',
  })
  @ApiForbiddenResponse({
    description:
      'Banned account, or an account you blocked, that blocked you, or that no longer exists.',
  })
  @ApiConflictResponse({ description: 'You are already friends.' })
  createFriendship(
    @ValidatedBody(ApiFriendshipCreateSchema) body: ApiFriendshipCreateDTO,
    @CurrentUser() caller: User,
  ) {
    return this.friendshipsService.createFriendship(body, caller);
  }

  @Get(':id')
  @CheckAbilities(['read', 'Friendship'])
  @ApiOperation({
    summary: 'One friendship',
    description:
      'A friendship the caller may not see answers 404, like a missing one. The two parties are named by their role: who asked, and who has to answer.',
  })
  @ApiOkResponse({ schema: toOpenApi(ApiFriendshipSchema) })
  @ApiNotFoundResponse({
    description: 'No such friendship, or not visible to you.',
  })
  @ApiIdParamDocs('Friendship to read.')
  findOneFriendship(@IdParam() id: number, @CurrentUser() caller: User) {
    return this.friendshipsService.findOneFriendship(id, caller);
  }

  @Patch(':id')
  @CheckAbilities(['update', 'Friendship'])
  @ApiOperation({
    summary: 'Answer a request',
    description:
      'The addressee only, and only while the request is pending: a request is answered once. There is no way back to pending, and the requester cannot answer on their own behalf.',
  })
  @ApiBody({ schema: toOpenApi(ApiFriendshipUpdateSchema) })
  @ApiOkResponse({ schema: toOpenApi(ApiFriendshipSchema) })
  @ApiBadRequestResponse({ description: 'Unknown field or invalid status.' })
  @ApiForbiddenResponse({
    description: 'Banned account, not yours to answer, or already answered.',
  })
  @ApiNotFoundResponse({
    description: 'No such friendship, or not visible to you.',
  })
  @ApiIdParamDocs('Request to answer.')
  updateFriendship(
    @IdParam() id: number,
    @ValidatedBody(ApiFriendshipUpdateSchema) body: ApiFriendshipUpdateDTO,
    @CurrentUser() caller: User,
  ) {
    return this.friendshipsService.updateFriendship(id, body, caller);
  }

  @Delete(':id')
  @HttpCode(204)
  @CheckAbilities(['delete', 'Friendship'])
  @ApiOperation({
    summary: 'Withdraw from a friendship',
    description:
      'Soft delete, by either party, whatever the state: it cancels a request you sent as well as it unfriends someone. Asking again later reopens the same friendship.',
  })
  @ApiNoContentResponse({ description: 'Friendship withdrawn.' })
  @ApiForbiddenResponse({ description: 'Banned account, or not yours.' })
  @ApiNotFoundResponse({
    description: 'No such friendship, or not visible to you.',
  })
  @ApiIdParamDocs('Friendship to withdraw from.')
  removeFriendship(@IdParam() id: number, @CurrentUser() caller: User) {
    return this.friendshipsService.removeFriendship(id, caller);
  }
}
