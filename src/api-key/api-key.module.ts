import { Module } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { ApiKeySyncService } from './api-key-sync.service';

@Module({
  providers: [ApiKeyService, ApiKeySyncService],
  exports: [ApiKeyService],
})
export class ApiKeyModule {}
