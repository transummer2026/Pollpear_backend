import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiV1Service } from './v1.service';
import { toOpenApi } from './common/openapi';
import { ApiIndexSchema } from './common/schemas/api-index.schema';

@ApiTags('v1')
@Controller('v1')
export class ApiV1Controller {
  constructor(private readonly v1Service: ApiV1Service) {}

  /**
   * Discovery entry point. It is not public, so a 200 here is also the
   * cheapest proof that an API key is valid
   */
  @Get()
  @ApiOperation({
    summary: 'Discovery entry point',
    description:
      'Lists the resources this version exposes. Requires a valid API key, so it doubles as the cheapest way to check one.',
  })
  @ApiOkResponse({ schema: toOpenApi(ApiIndexSchema) })
  index() {
    return this.v1Service.index();
  }
}
