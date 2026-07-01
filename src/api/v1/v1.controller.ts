import { Controller, Get, Param, ParseIntPipe, HttpCode } from '@nestjs/common';
import { ApiV1Service } from './v1.service';

@Controller('api/v1')
export class ApiV1Controller {
  constructor(private readonly v1Service: ApiV1Service) {}
}
