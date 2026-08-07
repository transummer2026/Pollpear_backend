import { ArgumentsHost, Catch, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

/**
 * Catch-all for websocket handlers, the WS counterpart of the HTTP
 * exception filters wired in main.ts. WsExceptions pass through
 * unchanged; anything else (Prisma failure, programming error) is
 * logged with its socket context and turned into an opaque WsException
 * so the client gets a clean exception event and no internals leak.
 */
@Catch()
export class WsExceptionsFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WsExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof WsException) {
      super.catch(exception, host);
      return;
    }
    const client = host.switchToWs().getClient<Socket>();
    this.logger.error(
      `unhandled error on socket ${client.id}`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    super.catch(new WsException('Internal server error'), host);
  }
}
