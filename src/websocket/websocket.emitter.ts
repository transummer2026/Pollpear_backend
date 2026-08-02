import { Injectable, Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

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
    this.server.to(`user:${userId}`).emit(event, payload);
    this.logger.debug(`sent ${event} to user ${userId}`);
  }

  async revokeUser(userId: number): Promise<void> {
    if (!this.server) {
      this.logger.warn(`cannot revoke user ${userId}: server not ready`);
      return;
    }
    const room = `user:${userId}`;
    const sockets = await this.server.in(room).fetchSockets();
    if (sockets.length === 0) {
      this.logger.warn(`user ${userId} has no open socket, nothing to revoke`);
      return;
    }
    this.server.to(room).emit('session:revoked');
    this.server.in(room).disconnectSockets(true);
    this.logger.log(
      `session revoked for user ${userId}, ${sockets.length} socket(s) closed`,
    );
  }
}
