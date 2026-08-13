import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';

@Injectable()
export class ApiKeySyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ApiKeySyncService.name);

  constructor(private readonly apiKeyService: ApiKeyService) {}

  async onApplicationBootstrap() {
    try {
      const restored = await this.apiKeyService.restoreAll();
      this.logger.log(`restored ${restored} api key(s) in redis`);
    } catch (error) {
      this.logger.error(`could not restore api keys: ${String(error)}`);
    }
  }
}
