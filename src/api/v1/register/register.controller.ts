import { Controller, HttpCode, Post } from '@nestjs/common';
import { ApiRegisterService } from './register.service';

@Controller('api/v1/register')
export class ApiRegisterController {
  constructor(private readonly registerService: ApiRegisterService) {}

  @Post()
  @HttpCode(503)
  create() {
    return this.registerService.create();
  }
}
