// src/api/v1/users/users.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { User } from 'src/generated/prisma/client';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiUsersService } from './users.service';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { CheckAbilities } from 'src/common/decorators/check-ability.decorator';
import { toOpenApi } from '../common/openapi';
import { ApiPageQueryDocs } from '../common/api-docs';
import { ApiUserPageSchema } from '../common/schemas/api-users.schema';
import {
  ApiPageQuerySchema,
  type ApiPageQueryDTO,
} from '../common/schemas/api-pagination.schema';

@ApiTags('users')
@Controller('v1/users')
export class ApiUsersController {
  constructor(private readonly usersService: ApiUsersService) {}

  @Get()
  @CheckAbilities(['read', 'User'])
  @ApiOperation({
    summary: 'List the accounts that agreed to be listed',
    description:
      'Paginated. Soft deleted and private accounts never appear, whoever asks.',
  })
  @ApiPageQueryDocs()
  @ApiOkResponse({ schema: toOpenApi(ApiUserPageSchema) })
  @ApiUnauthorizedResponse({
    description: 'Missing, expired or revoked api key.',
  })
  findAllUsers(
    @Query(new ZodValidationPipe(ApiPageQuerySchema)) query: ApiPageQueryDTO,
    @CurrentUser() caller: User,
  ) {
    return this.usersService.findAllUsers(query, caller);
  }
}
