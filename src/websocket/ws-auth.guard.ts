import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { payloadPreview } from 'src/common/payload-preview';
import { socketUserId } from './socket-user';

/**
 * Rejects websocket events from sockets that were never bound to a
 * user at handshake time. The refused payload is logged server side,
 * the client only gets the short reason on its exception event.
 */
@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();
    if (socketUserId(client) === null) {
      const payload = context.switchToWs().getData<unknown>();
      this.logger.warn(
        `Unauthorized (socket ${client.id}, payload ${payloadPreview(payload)})`,
      );
      throw new WsException('Unauthorized');
    }
    return true;
  }
}
