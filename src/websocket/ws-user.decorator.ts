import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { socketAuthUser } from './socket-user';
import { User } from 'src/generated/prisma/client';

export const WsUser = createParamDecorator(
  (data: unknown, context: ExecutionContext): User => {
    const user = socketAuthUser(context.switchToWs().getClient<Socket>());
    if (user === null) throw new WsException('Unauthorized');
    return user;
  },
);
