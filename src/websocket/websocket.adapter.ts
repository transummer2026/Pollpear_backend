import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions } from 'socket.io';
import { VaultService, WsConfig } from 'src/vault/vault.service';
import {
  bindSocketUser,
  handshakeUserId,
  socketUserId,
  userChannel,
} from './socket-user';
import { websocketOptions } from './websocket.config';

interface EngineSocket {
  id: string;
  on: (event: 'close', listener: (reason: string) => void) => void;
}

export class WebsocketAdapter extends IoAdapter {
  private readonly logger = new Logger(WebsocketAdapter.name);

  private readonly wsConfig: WsConfig;

  constructor(appContext: INestApplicationContext) {
    super(appContext);
    this.wsConfig = appContext.get(VaultService).ws;
  }

  /**
   * Builds the server from the Vault config (secret/pollpear/ws), then
   * installs authentication and channel subscription on it.
   */
  createIOServer(port: number, options?: ServerOptions): Server {
    const resolved = websocketOptions(this.wsConfig, options);
    this.logger.log(
      `socket.io server on path ${String(resolved.path)}, transports ${String(resolved.transports)}`,
    );
    this.logger.log(
      `heartbeat: ping every ${resolved.pingInterval}ms, timeout ${resolved.pingTimeout}ms, max payload ${resolved.maxHttpBufferSize}B`,
    );
    const server = super.createIOServer(port, resolved) as Server;
    this.authenticateConnections(server);
    this.subscribeToUserChannel(server);
    this.logEngineConnections(server);
    this.logEngineConnectionErrors(server);
    return server;
  }

  /**
   * Admission control: a socket without a valid x-user-id injected by
   * the Rust gateway never reaches a gateway handler. Authentication is
   * a property of the server rather than of one gateway, which no
   * refactor of a feature can silently switch off.
   */
  private authenticateConnections(server: Server): void {
    server.use((socket, next) => {
      const userId = handshakeUserId(socket);
      if (userId === null) {
        this.logger.warn(
          `socket ${socket.id} refused: no valid x-user-id on handshake`,
        );
        next(new Error('Unauthorized'));
        return;
      }
      bindSocketUser(socket, userId);
      next();
    });
  }

  /**
   * Every broadcast addresses users through their channel, so joining it
   * belongs to the transport: leaving it to a gateway would make
   * outgoing traffic depend on that gateway being present. Nest binds
   * the gateway handlers after this adapter returns the server, so this
   * listener runs first and the channel is joined before any gateway
   * sees the connection.
   */
  private subscribeToUserChannel(server: Server): void {
    server.on('connection', (socket) => {
      const userId = socketUserId(socket);
      if (userId === null) return;
      void socket.join(userChannel(userId));
    });
  }

  /**
   * Logs the raw engine.io layer, one stage below the gateways. A client
   * that upgrades but never sends the socket.io CONNECT packet never
   * reaches handleConnection, so it is invisible everywhere else.
   */
  private logEngineConnections(server: Server): void {
    server.engine.on('connection', (socket: EngineSocket) => {
      this.logger.debug(`transport open: ${socket.id}`);
      socket.on('close', (reason: string) =>
        this.logger.debug(`transport closed: ${socket.id} (${reason})`),
      );
    });
  }

  private logEngineConnectionErrors(server: Server): void {
    server.engine.on('connection_error', (error: { message: string }) =>
      this.logger.warn(`handshake refused: ${error.message}`),
    );
  }
}
