import { Module } from '@nestjs/common';
import { ApiService } from './api.service';
import { ApiController } from './api.controller';
import { ApiV1Module } from './v1/v1.module';

@Module({
  controllers: [ApiController],
  providers: [ApiService], // no need to register in app.module.ts
  imports: [ApiV1Module],
})
export class ApiModule {}
