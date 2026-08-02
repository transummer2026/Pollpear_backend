import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions } from 'socket.io';
import { websocketOptions } from './websocket.config';

interface EngineSocket {
  id: string;
  on: (event: 'close', listener: (reason: string) => void) => void;
}

export class WebsocketAdapter extends IoAdapter {
  private readonly logger = new Logger(WebsocketAdapter.name);

  constructor(app: INestApplicationContext) {
    super(app);
  }

  /**
   * Logs the options the server is actually built with. A missing
   * WS_PATH silently falls back to the socket.io default and every
   * client then gets a 404, so the effective path is worth stating.
   */
  createIOServer(port: number, options?: ServerOptions): Server {
    const resolved = websocketOptions(options);
    const corsOrigin =
      resolved.cors && 'origin' in resolved.cors
        ? String(resolved.cors.origin)
        : 'delegate';
    this.logger.log(
      `socket.io server on path ${String(resolved.path)}, transports ${String(resolved.transports)}, cors origin ${corsOrigin}`,
    );
    this.logger.log(
      `heartbeat: ping every ${resolved.pingInterval}ms, timeout ${resolved.pingTimeout}ms, max payload ${resolved.maxHttpBufferSize}B`,
    );
    const server = super.createIOServer(port, resolved) as Server;
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
