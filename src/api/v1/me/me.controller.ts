// src/api/v1/me/me.controller.ts
import { Body, Controller, Delete, Get, HttpCode, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiMeService } from './me.service';
import { UserId } from 'src/common/decorators/user-id.decorator';
import { CheckAbilities } from 'src/common/decorators/check-ability.decorator';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { toOpenApi } from '../common/openapi';
import {
  ApiMeSchema,
  ApiMeUpdateSchema,
  type ApiMeUpdateDTO,
} from '../common/schemas/api-me.schema';

@ApiTags('me')
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
  @ApiUnauthorizedResponse({
    description: 'Missing, expired or revoked api key, or deleted owner.',
  })
  findMe(@UserId() ownerId: number) {
    return this.meService.findMe(ownerId);
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
  @ApiUnauthorizedResponse({
    description: 'Missing, expired or revoked api key, or deleted owner.',
  })
  updateMe(
    @UserId() ownerId: number,
    @Body(new ZodValidationPipe(ApiMeUpdateSchema)) body: ApiMeUpdateDTO,
  ) {
    return this.meService.updateMe(ownerId, body);
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete the account behind the api key',
    description:
      'Soft deletes the account, revokes every api key it owns and closes its open sockets. The key used for this call stops working right after.',
  })
  @ApiNoContentResponse({ description: 'Account deleted.' })
  @ApiUnauthorizedResponse({
    description: 'Missing, expired or revoked api key, or deleted owner.',
  })
  deleteMe(@UserId() ownerId: number) {
    return this.meService.deleteMe(ownerId);
  }
}
