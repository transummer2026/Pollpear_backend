import { Module } from '@nestjs/common';
import { ApiRegisterService } from './register.service';
import { ApiRegisterController } from './register.controller';

@Module({
  controllers: [ApiRegisterController],
  providers: [ApiRegisterService],
})
export class ApiRegisterModule {}
