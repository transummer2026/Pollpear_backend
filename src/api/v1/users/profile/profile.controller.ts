import { Controller, Get } from '@nestjs/common';
import { IdParam } from '../../common/params';
import { ApiGuardDocs, ApiIdParamDocs } from '../../common/api-docs';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CheckAbilities } from 'src/common/decorators/check-ability.decorator';
import type { User } from 'src/generated/prisma/client';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiUserProfileService } from './profile.service';
import { toOpenApi } from '../../common/openapi';
import { ApiUserSchema } from '../../common/schemas/api-users.schema';

@ApiTags('users')
@ApiGuardDocs()
@Controller('v1/users/:id')
export class ApiUserProfileController {
  constructor(private readonly userService: ApiUserProfileService) {}

  @Get()
  @CheckAbilities(['read', 'User'])
  @ApiOperation({
    summary: 'Public profile of one account',
    description:
      'Counters are computed on read. A private or deleted account answers 404, so this route never confirms that a hidden profile exists.',
  })
  @ApiOkResponse({ schema: toOpenApi(ApiUserSchema) })
  @ApiNotFoundResponse({ description: 'No such account, or not listed.' })
  @ApiBadRequestResponse({
    description:
      'An id that cannot designate an account: zero, negative, or not a whole number.',
  })
  @ApiIdParamDocs(
    'Account to read. A hidden account answers 404, like a missing one.',
  )
  findOneUser(@IdParam() id: number, @CurrentUser() caller: User) {
    return this.userService.findOneUser(id, caller);
  }
}
