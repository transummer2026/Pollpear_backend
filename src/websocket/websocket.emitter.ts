import { Injectable, Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { userChannel } from './socket-user';

@Injectable()
@WebSocketGateway()
export class WebsocketEmitter {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebsocketEmitter.name);

  toUser(userId: number, event: string, payload?: unknown): void {
    if (!this.server) {
      this.logger.warn(`dropped ${event} for user ${userId}: server not ready`);
      return;
    }
    this.server.to(userChannel(userId)).emit(event, payload);
    this.logger.debug(`sent ${event} to user ${userId}`);
  }

  async revokeUser(userId: number): Promise<void> {
    if (!this.server) {
      this.logger.warn(`cannot revoke user ${userId}: server not ready`);
      return;
    }
    const channel = userChannel(userId);
    const sockets = await this.server.to(channel).fetchSockets();
    if (sockets.length === 0) {
      this.logger.warn(`user ${userId} has no open socket, nothing to revoke`);
      return;
    }
    this.server.to(channel).emit('session:revoked');
    this.server.to(channel).disconnectSockets(true);
    this.logger.log(
      `session revoked for user ${userId}, ${sockets.length} socket(s) closed`,
    );
  }
}
