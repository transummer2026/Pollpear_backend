// src/api/v1/users/users.controller.ts
import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiUsersService } from './users.service';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { toOpenApi } from '../common/openapi';
import {
  ApiUserPageSchema,
  ApiUserSchema,
} from '../common/schemas/api-users.schema';
import {
  ApiPageQuerySchema,
  type ApiPageQueryDTO,
} from '../common/schemas/api-pagination.schema';

@ApiTags('users')
@Controller('v1/users')
export class ApiUsersController {
  constructor(private readonly usersService: ApiUsersService) {}

  @Get()
  @ApiOperation({
    summary: 'List the accounts that agreed to be listed',
    description:
      'Paginated. Soft deleted and private accounts never appear, whoever asks.',
  })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer' } })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer' } })
  @ApiOkResponse({ schema: toOpenApi(ApiUserPageSchema) })
  @ApiUnauthorizedResponse({
    description: 'Missing, expired or revoked api key.',
  })
  findAllUsers(
    @Query(new ZodValidationPipe(ApiPageQuerySchema)) query: ApiPageQueryDTO,
  ) {
    return this.usersService.findAllUsers(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Public profile of one account',
    description:
      'Counters are computed on read. A private or deleted account answers 404, so this route never confirms that a hidden profile exists.',
  })
  @ApiOkResponse({ schema: toOpenApi(ApiUserSchema) })
  @ApiNotFoundResponse({ description: 'No such account, or not listed.' })
  @ApiUnauthorizedResponse({
    description: 'Missing, expired or revoked api key.',
  })
  findOneUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOneUser(id);
  }
}
