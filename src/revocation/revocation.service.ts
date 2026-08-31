// src/revocation/revocation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { ApiKeyService } from 'src/api-key/api-key.service';
import { WebsocketEmitter } from 'src/websocket/websocket.emitter';

@Injectable()
export class RevocationService {
  private readonly logger = new Logger(RevocationService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly apiKeyService: ApiKeyService,
    private readonly websocketEmitter: WebsocketEmitter,
  ) {}

  async revokeAllSessions(userId: number): Promise<void> {
    await this.redis.deleteUserSessions(userId);
    await this.websocketEmitter.revokeUser(userId);

    this.logger.log(`all sessions revoked for user ${userId}`);
  }

  async revokeAllAccess(userId: number): Promise<void> {
    await this.revokeAllSessions(userId);
    await this.apiKeyService.revokeAll(userId);

    this.logger.log(`all access revoked for user ${userId}`);
  }
}
