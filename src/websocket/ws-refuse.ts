import { Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { payloadPreview } from 'src/common/payload-preview';

/**
 * Refusals are logged before being thrown: the client only receives the
 * short reason on its exception event, the server keeps who asked what.
 * The caller's logger is passed in so the log line keeps its gateway
 * context.
 */
export function refuseWs(
  logger: Logger,
  client: Socket,
  reason: string,
  payload: unknown,
): never {
  logger.warn(
    `${reason} (socket ${client.id}, payload ${payloadPreview(payload)})`,
  );
  throw new WsException(reason);
}
