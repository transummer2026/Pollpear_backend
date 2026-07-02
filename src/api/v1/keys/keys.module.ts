import { Module } from '@nestjs/common';
import { ApiKeysService } from './keys.service';
import { ApiKeysController } from './keys.controller';

@Module({
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
})
export class ApiKeysModule {}
