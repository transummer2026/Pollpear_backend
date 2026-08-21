import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UsersService } from 'src/users/users.service';
import { AuthenticatedGateway } from 'src/websocket/authenticated-gateway.decorator';
import { socketUserId, userChannel } from 'src/websocket/socket-user';
import { WebsocketEmitter } from 'src/websocket/websocket.emitter';
import { PresenceService } from './presence.service';

@AuthenticatedGateway()
export class PresenceGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnApplicationBootstrap
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PresenceGateway.name);

  constructor(
    private presence: PresenceService,
    private users: UsersService,
    private emitter: WebsocketEmitter,
  ) {}

  async onApplicationBootstrap() {
    const count = await this.presence.resetAll();
    if (count > 0) {
      this.logger.warn(`reset ${count} stale online user(s) at startup`);
    }
  }

  async handleConnection(client: Socket) {
    const userId = socketUserId(client);
    if (userId === null) {
      client.disconnect(true);
      return;
    }

    try {
      if ((await this.countSockets(userId)) !== 1) return;
      await this.presence.setOnline(userId);
      await this.notifyFriends(userId, 'friend:online');
      if ((await this.countSockets(userId)) === 0) {
        await this.presence.setOffline(userId);
        await this.notifyFriends(userId, 'friend:offline');
      }
    } catch (error) {
      this.logError('online', userId, error);
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = socketUserId(client);
    if (userId === null) return;

    try {
      if ((await this.countSockets(userId)) !== 0) return;
      await this.presence.setOffline(userId);
      await this.notifyFriends(userId, 'friend:offline');
      if ((await this.countSockets(userId)) > 0) {
        await this.presence.setOnline(userId);
        await this.notifyFriends(userId, 'friend:online');
      }
    } catch (error) {
      this.logError('offline', userId, error);
    }
  }

  private async notifyFriends(userId: number, event: string) {
    const friends = await this.users.friendIds(userId);
    this.emitter.toUsers(friends, event, { userId });
  }

  private async countSockets(userId: number): Promise<number> {
    const sockets = await this.server.to(userChannel(userId)).fetchSockets();
    return sockets.length;
  }

  private logError(transition: string, userId: number, error: unknown) {
    this.logger.error(
      `presence ${transition} failed for user ${userId}`,
      error instanceof Error ? error.stack : String(error),
    );
  }
}
