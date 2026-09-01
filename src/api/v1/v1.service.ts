import { Injectable } from '@nestjs/common';
import { apiV1 } from './common/api-v1';
import type { ApiIndexDTO } from './common/schemas/api-index.schema';

@Injectable()
export class ApiV1Service {
  index(): ApiIndexDTO {
    return apiV1;
  }
}
