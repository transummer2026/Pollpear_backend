// src/api/v1/admin/staff/staff.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiAdminStaffService } from './staff.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { User } from 'src/generated/prisma/client';
import { CheckAbilities } from 'src/common/decorators/check-ability.decorator';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { toOpenApi } from '../../common/openapi';
import { ApiPageQueryDocs } from '../../common/api-docs';
import { ApiStaffPageSchema } from '../../common/schemas/api-admin.schema';
import {
  ApiPageQuerySchema,
  type ApiPageQueryDTO,
} from '../../common/schemas/api-pagination.schema';

@ApiTags('admin')
@ApiForbiddenResponse({ description: 'The key owner lacks the required role.' })
@ApiUnauthorizedResponse({
  description: 'Missing, expired or revoked api key.',
})
@Controller('v1/admin/staff')
export class ApiAdminStaffController {
  constructor(private readonly adminService: ApiAdminStaffService) {}

  @Get()
  @CheckAbilities(['moderate', 'User'])
  @ApiOperation({
    summary: 'List the accounts holding a staff role',
    description:
      'Admins and moderators, paginated. Reserved to those same roles: a regular key gets 403.',
  })
  @ApiPageQueryDocs()
  @ApiOkResponse({ schema: toOpenApi(ApiStaffPageSchema) })
  findStaff(
    @Query(new ZodValidationPipe(ApiPageQuerySchema)) query: ApiPageQueryDTO,
    @CurrentUser() caller: User,
  ) {
    return this.adminService.findStaff(query, caller);
  }
}
