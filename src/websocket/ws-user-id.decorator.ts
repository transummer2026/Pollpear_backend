import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { socketUserId } from './socket-user';

/**
 * Websocket counterpart of the HTTP UserId decorator: injects the user
 * id bound to the socket at handshake time. Throws instead of returning
 * null so a handler that forgot AuthGuard cannot silently receive an
 * unauthenticated user; the guard stays the primary barrier (it runs
 * before the validation pipes).
 */
export const WsUserId = createParamDecorator(
  (data: unknown, context: ExecutionContext): number => {
    const userId = socketUserId(context.switchToWs().getClient<Socket>());
    if (userId === null) throw new WsException('Unauthorized');
    return userId;
  },
);
