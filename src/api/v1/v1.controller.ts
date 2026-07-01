import { Controller, Get, Param, ParseIntPipe, HttpCode } from '@nestjs/common';
import { V1Service } from './v1.service';

@Controller('api/v1')
export class V1Controller {
  constructor(private readonly v1Service: V1Service) {}
}
