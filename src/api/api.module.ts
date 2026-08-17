import { Module } from '@nestjs/common';
import { ApiV1Module } from './v1/v1.module';

@Module({
  imports: [ApiV1Module],
})
export class ApiModule {}
