import { Injectable } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@Injectable()
@WebSocketGateway()
export class WebsocketEmitter {
  @WebSocketServer()
  server: Server;

  toUser(userId: number, event: string, payload?: unknown): void {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  revokeUser(userId: number): void {
    const room = `user:${userId}`;
    this.server?.to(room).emit('session:revoked');
    this.server?.in(room).disconnectSockets(true);
  }
}
