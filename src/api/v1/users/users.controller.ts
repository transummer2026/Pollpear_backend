import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { User } from 'src/generated/prisma/client';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiUsersService } from './users.service';
import { CheckAbilities } from 'src/common/decorators/check-ability.decorator';
import { toOpenApi } from '../common/openapi';
import { ApiGuardDocs, ApiPageQueryDocs } from '../common/api-docs';
import { ValidatedQuery } from '../common/params';
import { ApiUserPageSchema } from '../common/schemas/api-users.schema';
import {
  ApiPageQuerySchema,
  type ApiPageQueryDTO,
} from '../common/schemas/api-pagination.schema';

@ApiTags('users')
@ApiGuardDocs()
@Controller('v1/users')
export class ApiUsersController {
  constructor(private readonly usersService: ApiUsersService) {}

  @Get()
  @CheckAbilities(['read', 'User'])
  @ApiOperation({
    summary: 'List the accounts that agreed to be listed',
    description:
      'Paginated. Soft deleted and private accounts never appear, whoever asks, and neither do the accounts that blocked the caller.',
  })
  @ApiPageQueryDocs()
  @ApiOkResponse({ schema: toOpenApi(ApiUserPageSchema) })
  @ApiBadRequestResponse({
    description:
      'A limit above what the key allows, or a page past the last one. Neither is trimmed: a shortened answer would read as the end of the list.',
  })
  findAllUsers(
    @ValidatedQuery(ApiPageQuerySchema) query: ApiPageQueryDTO,
    @CurrentUser() caller: User,
  ) {
    return this.usersService.findAllUsers(query, caller);
  }
}
