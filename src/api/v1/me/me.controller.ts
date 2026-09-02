import { Controller, Delete, Get, HttpCode, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiMeService } from './me.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CheckAbilities } from 'src/common/decorators/check-ability.decorator';
import type { User } from 'src/generated/prisma/client';
import { ValidatedBody } from '../common/params';
import { ApiSelfGuardDocs } from '../common/api-docs';
import { toOpenApi } from '../common/openapi';
import {
  ApiMeSchema,
  ApiMeUpdateSchema,
  type ApiMeUpdateDTO,
} from '../common/schemas/api-me.schema';

@ApiTags('me')
@ApiSelfGuardDocs()
@Controller('v1/me')
export class ApiMeController {
  constructor(private readonly meService: ApiMeService) {}

  @Get()
  @CheckAbilities(['read', 'User'])
  @ApiOperation({
    summary: 'The account behind the api key',
    description:
      'Returns the full profile of the user the key acts on behalf of. Shortcut for GET /v1/users/{id} when that id is your own.',
  })
  @ApiOkResponse({ schema: toOpenApi(ApiMeSchema) })
  @ApiForbiddenResponse({
    description:
      'Banned account, or one the policy no longer lets read itself.',
  })
  findMe(@CurrentUser() viewer: User) {
    return this.meService.findMe(viewer);
  }

  @Patch()
  @CheckAbilities(['update', 'User'])
  @ApiOperation({
    summary: 'Edit the account behind the api key',
    description:
      'Updates the fields sent, leaves the others untouched. Identity fields (username, email, birthdate, nationality) and role are not editable here.',
  })
  @ApiBody({ schema: toOpenApi(ApiMeUpdateSchema) })
  @ApiOkResponse({ schema: toOpenApi(ApiMeSchema) })
  @ApiBadRequestResponse({
    description: 'Unknown field, value too long, or empty body.',
  })
  @ApiForbiddenResponse({
    description: 'Banned account, or a field the policy keeps read-only.',
  })
  updateMe(
    @CurrentUser() viewer: User,
    @ValidatedBody(ApiMeUpdateSchema) body: ApiMeUpdateDTO,
  ) {
    return this.meService.updateMe(viewer, body);
  }

  @Delete()
  @HttpCode(204)
  @CheckAbilities(['delete', 'User'])
  @ApiOperation({
    summary: 'Delete the account behind the api key',
    description:
      'Soft deletes the account, revokes every api key it owns and closes its open sockets. The key used for this call stops working right after.',
  })
  @ApiNoContentResponse({ description: 'Account deleted.' })
  @ApiForbiddenResponse({
    description:
      'Banned account, or one the policy does not let delete itself.',
  })
  deleteMe(@CurrentUser() viewer: User) {
    return this.meService.deleteMe(viewer);
  }
}
