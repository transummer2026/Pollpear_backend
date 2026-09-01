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
import { ApiRoomsService } from './rooms.service';
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
  ApiRoomCreateSchema,
  ApiRoomFilterSchema,
  ApiRoomPageSchema,
  ApiRoomQuerySchema,
  ApiRoomSchema,
  ApiRoomUpdateSchema,
  type ApiRoomCreateDTO,
  type ApiRoomQueryDTO,
  type ApiRoomUpdateDTO,
} from '../common/schemas/api-rooms.schema';

@ApiTags('rooms')
@ApiGuardDocs()
@Controller('v1/rooms')
export class ApiRoomsController {
  constructor(private readonly roomsService: ApiRoomsService) {}

  @Get()
  @CheckAbilities(['read', 'Room'])
  @ApiOperation({
    summary: 'List the rooms the caller may see',
    description:
      'Public rooms, and the private ones you belong to. A room whose owner blocked you, or whom you blocked, stays out. A moderator sees every live room, an admin the deleted ones too. Newest first: pages are ordered by descending id. Every row carries its deadline, and a room past that deadline already reads as closed, filters included. Deleted rooms are the one exception, and only an admin sees those: they are filtered on the status they were stored with, while the row itself reports the truth.',
  })
  @ApiPageQueryDocs()
  @ApiFilterDocs(ApiRoomFilterSchema)
  @ApiOkResponse({ schema: toOpenApi(ApiRoomPageSchema) })
  @ApiBadRequestResponse({
    description: 'Unknown parameter, invalid filter, or page past the last.',
  })
  findAllRooms(
    @ValidatedQuery(ApiRoomQuerySchema) query: ApiRoomQueryDTO,
    @CurrentUser() caller: User,
  ) {
    return this.roomsService.findAllRooms(query, caller);
  }

  @Post()
  @CheckAbilities(['create', 'Room'])
  @ApiOperation({
    summary: 'Create a room',
    description:
      'The owner is the key owner, never the body. A room opens active and its owner joins it as a member in the same write. endsAt is optional and schedules the close: leave it out for a room that stays open until someone deletes it. The banner is not taken from the body: every room starts on the default one.',
  })
  @ApiBody({ schema: toOpenApi(ApiRoomCreateSchema) })
  @ApiCreatedResponse({ schema: toOpenApi(ApiRoomSchema) })
  @ApiBadRequestResponse({ description: 'Unknown field or invalid value.' })
  createRoom(
    @ValidatedBody(ApiRoomCreateSchema) body: ApiRoomCreateDTO,
    @CurrentUser() caller: User,
  ) {
    return this.roomsService.createRoom(body, caller);
  }

  @Get(':id')
  @CheckAbilities(['read', 'Room'])
  @ApiOperation({
    summary: 'One room, with its member and poll counts',
    description:
      'A room the caller may not see answers 404, like a missing one. A room past its deadline reads as closed, whether or not anything has touched it since. The poll count follows the same rules as the poll routes: it counts the polls you could actually read, so a private poll in a public room is never revealed by the tally.',
  })
  @ApiOkResponse({ schema: toOpenApi(ApiRoomSchema) })
  @ApiNotFoundResponse({ description: 'No such room, or not visible to you.' })
  @ApiIdParamDocs('Room to read.')
  findOneRoom(@IdParam() id: number, @CurrentUser() caller: User) {
    return this.roomsService.findOneRoom(id, caller);
  }

  @Patch(':id')
  @CheckAbilities(['update', 'Room'])
  @ApiOperation({
    summary: 'Edit a room that is still open',
    description:
      'The owner only, and only while the room is active. A room closes on its own once endsAt passes, and a closed room is final: every field is refused from then on, endsAt included, so a deadline cannot be pushed back to reopen it. Closing is one way — a room that has ended is replaced, not revived.',
  })
  @ApiBody({ schema: toOpenApi(ApiRoomUpdateSchema) })
  @ApiOkResponse({ schema: toOpenApi(ApiRoomSchema) })
  @ApiBadRequestResponse({
    description: 'Unknown field, invalid value, or empty body.',
  })
  @ApiForbiddenResponse({ description: 'Not your room.' })
  @ApiConflictResponse({ description: 'The room is no longer active.' })
  @ApiNotFoundResponse({ description: 'No such room, or not visible to you.' })
  @ApiIdParamDocs('Room to edit.')
  updateRoom(
    @IdParam() id: number,
    @ValidatedBody(ApiRoomUpdateSchema) body: ApiRoomUpdateDTO,
    @CurrentUser() caller: User,
  ) {
    return this.roomsService.updateRoom(id, body, caller);
  }

  @Delete(':id')
  @HttpCode(204)
  @CheckAbilities(['delete', 'Room'])
  @ApiOperation({
    summary: 'Delete a room',
    description:
      'Soft delete, by the owner or a moderator. A closed room can still be deleted: no deadline stands in the way here. Whatever the room already holds stays where it is — nothing is erased, the room simply stops being served.',
  })
  @ApiNoContentResponse({ description: 'Room deleted.' })
  @ApiForbiddenResponse({ description: 'Not your room.' })
  @ApiNotFoundResponse({ description: 'No such room, or not visible to you.' })
  @ApiIdParamDocs('Room to delete.')
  removeRoom(@IdParam() id: number, @CurrentUser() caller: User) {
    return this.roomsService.removeRoom(id, caller);
  }
}
