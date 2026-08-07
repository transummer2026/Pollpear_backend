import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions } from 'socket.io';
import { VaultService } from 'src/vault/vault.service';
import { bindSocketUser, handshakeUserId } from './socket-user';
import { websocketOptions } from './websocket.config';

interface EngineSocket {
  id: string;
  on: (event: 'close', listener: (reason: string) => void) => void;
}

export class WebsocketAdapter extends IoAdapter {
  private readonly logger = new Logger(WebsocketAdapter.name);

  constructor(private readonly appContext: INestApplicationContext) {
    super(appContext);
  }

  /**
   * Builds the server from the Vault config (secret/pollpear/ws) and
   * installs the authentication middleware: a socket without a valid
   * x-user-id on the handshake is refused before any gateway runs, so
   * authentication is a property of the server, not of one gateway.
   * The adapter is built by hand in main.ts, hence VaultService is
   * resolved from the app context instead of constructor injection.
   */
  createIOServer(port: number, options?: ServerOptions): Server {
    const vault = this.appContext.get(VaultService);
    const resolved = websocketOptions(vault.ws, options);
    this.logger.log(
      `socket.io server on path ${String(resolved.path)}, transports ${String(resolved.transports)}`,
    );
    this.logger.log(
      `heartbeat: ping every ${resolved.pingInterval}ms, timeout ${resolved.pingTimeout}ms, max payload ${resolved.maxHttpBufferSize}B`,
    );
    const server = super.createIOServer(port, resolved) as Server;
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
    this.logTransportLayer(server);
    return server;
  }

  /**
   * Logs the raw engine.io layer, one stage below the gateways. A client
   * that upgrades but never sends the socket.io CONNECT packet never
   * reaches handleConnection, so it is invisible everywhere else.
   */
  private logTransportLayer(server: Server): void {
    server.engine.on('connection', (socket: EngineSocket) => {
      this.logger.debug(`transport open: ${socket.id}`);
      socket.on('close', (reason: string) =>
        this.logger.debug(`transport closed: ${socket.id} (${reason})`),
      );
    });
    server.engine.on('connection_error', (error: { message: string }) =>
      this.logger.warn(`handshake refused: ${error.message}`),
    );
  }
}
