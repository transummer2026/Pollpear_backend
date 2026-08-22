// src/api/v1/admin/users/users.controller.ts
import { Body, Controller, Delete, Get, HttpCode, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiAdminUserService } from './users.service';
import { IdParam } from '../../common/params';
import { ApiIdParamDocs } from '../../common/api-docs';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { User } from 'src/generated/prisma/client';
import { CheckAbilities } from 'src/common/decorators/check-ability.decorator';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { toOpenApi, toOpenApiOneOf } from '../../common/openapi';
import {
  ApiAdminUserSchema,
  ApiAdminUserUpdateSchema,
  ApiModerationUserSchema,
  type ApiAdminUserUpdateDTO,
} from '../../common/schemas/api-admin.schema';

@ApiTags('admin')
@ApiForbiddenResponse({ description: 'The key owner lacks the required role.' })
@ApiUnauthorizedResponse({
  description: 'Missing, expired or revoked api key.',
})
@ApiNotFoundResponse({ description: 'No such account.' })
@Controller('v1/admin/users/:id')
export class ApiAdminUserController {
  constructor(private readonly adminUserService: ApiAdminUserService) {}

  @Get()
  @CheckAbilities(['moderate', 'User'])
  @ApiOperation({
    summary: 'Full record of one account',
    description:
      'Unlike /v1/users/{id}, this one also sees private and deleted accounts. The payload shown here is the admin one; a moderator gets conduct only, without identity, contact details or api keys.',
  })
  @ApiOkResponse({
    schema: toOpenApiOneOf(ApiAdminUserSchema, ApiModerationUserSchema),
    description:
      'The admin schema for an admin caller, the moderation schema for a moderator.',
  })
  @ApiIdParamDocs('Account to read, private or deleted included.')
  findOneUser(@IdParam() id: number, @CurrentUser() caller: User) {
    return this.adminUserService.findOneUser(id, caller);
  }

  @Patch()
  @CheckAbilities(['moderate', 'User'])
  @ApiOperation({
    summary: 'Moderate one account',
    description:
      'A moderator can adjust visibility and email verification. role and deletedAt are admin only. deletedAt only ever takes null, which restores a deleted account: deleting one goes through DELETE, which also revokes its api keys.',
  })
  @ApiBody({ schema: toOpenApi(ApiAdminUserUpdateSchema) })
  @ApiOkResponse({
    schema: toOpenApiOneOf(ApiAdminUserSchema, ApiModerationUserSchema),
    description:
      'The admin schema for an admin caller, the moderation schema for a moderator.',
  })
  @ApiBadRequestResponse({
    description:
      'Unknown field, invalid value, empty body, or a deletedAt that is not null.',
  })
  @ApiForbiddenResponse({
    description:
      'The key owner lacks the required role, or a moderator tried to change role or deletedAt.',
  })
  @ApiIdParamDocs('Account to moderate.')
  updateUser(
    @IdParam() id: number,
    @Body(new ZodValidationPipe(ApiAdminUserUpdateSchema))
    body: ApiAdminUserUpdateDTO,
    @CurrentUser() caller: User,
  ) {
    return this.adminUserService.updateUser(id, body, caller);
  }

  @Delete()
  @HttpCode(204)
  @CheckAbilities(['delete', 'User'])
  @ApiOperation({
    summary: 'Delete one account',
    description:
      'Admins only. Soft delete: the account keeps its rows, but its api keys are revoked and its sockets closed.',
  })
  @ApiNoContentResponse({ description: 'Account deleted.' })
  @ApiIdParamDocs('Account to delete.')
  removeUser(@IdParam() id: number, @CurrentUser() caller: User) {
    return this.adminUserService.removeUser(id, caller);
  }
}
