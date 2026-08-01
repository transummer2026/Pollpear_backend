/**
 * Owns the websocket lifecycle for every client: authentication of the
 * connection, the user:{id} room used as addressing primitive by all
 * broadcasts, and online status (diagram events friend:online and
 * friend:offline, sent to accepted friends only).
 *
 * The connection itself is the presence signal, no client emit is
 * needed nor trusted. Tab counting is kept in process memory: correct
 * at one replica, to be revisited with the socket.io Redis adapter
 * decision when scaling horizontally.
 */
import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { FriendshipStatus } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  bindSocketUser,
  handshakeUserId,
  socketUserId,
} from 'src/websocket/socket-user';

@WebSocketGateway()
export class PresenceWsController
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PresenceWsController.name);
  private readonly socketsByUser = new Map<number, Set<string>>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * emit the online event to all accepted friends of a given user
   * @param client socket client that connected
   * @returns {void}
   */
  async handleConnection(client: Socket) {
    const userId = handshakeUserId(client);
    if (userId === null) {
      client.disconnect(true);
      return;
    }
    bindSocketUser(client, userId);
    await client.join(`user:${userId}`);

    const sockets = this.socketsByUser.get(userId) ?? new Set<string>();
    sockets.add(client.id);
    this.socketsByUser.set(userId, sockets);
    if (sockets.size > 1) return;

    try {
      await this.setOnline(userId, true);
      await this.emitToFriends(userId, 'friend:online');
    } catch (error) {
      this.logError('online', userId, error);
    }
  }

  /**
   * emit the offline event to all accepted friends of a given user
   * @param client socket client that disconnected
   * @returns {void}
   */
  async handleDisconnect(client: Socket) {
    const userId = socketUserId(client);
    if (userId === null) return;

    const sockets = this.socketsByUser.get(userId);
    sockets?.delete(client.id);
    if (!sockets || sockets.size > 0) return;
    this.socketsByUser.delete(userId);

    try {
      await this.setOnline(userId, false);
      await this.emitToFriends(userId, 'friend:offline');
    } catch (error) {
      this.logError('offline', userId, error);
    }
  }

  /**
   * set the online status of a user in the database
   * @param userId user id of the user whose presence changed
   * @param isOnline user online status to set
   * @returns {void}
   */
  private setOnline(userId: number, isOnline: boolean) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isOnline, lastSeenAt: new Date() },
    });
  }

  /**
   *  emits a presence event to all accepted friends of a given user
   * @param userId user id of the user whose presence changed
   * @param event  the event to emit, either friend:online or friend:offline
   * @returns {void}
   */
  private async emitToFriends(userId: number, event: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.accepted,
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: { requesterId: true, addresseeId: true },
    });
    if (friendships.length === 0) return;

    const rooms = friendships.map(
      (f) => `user:${f.requesterId === userId ? f.addresseeId : f.requesterId}`,
    );
    this.server.to(rooms).emit(event, { userId });
  }

  /**
   * log a error of presence for a given user
   * @param {string} transition th e presense trasition (online/offline)
   * @param {number} userId id of user
   * @param {unknown} error error to log
   * @returns {void}
   */
  private logError(transition: string, userId: number, error: unknown) {
    this.logger.error(
      `presence ${transition} failed for user ${userId}`,
      error instanceof Error ? error.stack : String(error),
    );
  }
}
