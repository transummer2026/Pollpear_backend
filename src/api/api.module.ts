import { Module } from '@nestjs/common';
import { ApiService } from './api.service';
import { ApiController } from './api.controller';
import { V1Module } from './v1/v1.module';

@Module({
  controllers: [ApiController],
  providers: [ApiService],
  imports: [V1Module],
})
export class ApiModule {}
