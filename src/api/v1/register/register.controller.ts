import { Controller, HttpCode, Post } from '@nestjs/common';
import { RegisterService } from './register.service';

@Controller('api/v1/register')
export class RegisterController {
  constructor(private readonly registerService: RegisterService) {}

  @Post()
  @HttpCode(503)
  create() {
    return this.registerService.create();
  }
}
