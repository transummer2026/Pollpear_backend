import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Socket } from 'socket.io';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { extractUserId } from 'src/common/extract-user-id';
import { User } from 'src/generated/prisma/client';
import { UsersService } from 'src/users/users.service';
import { bindSocketAuthUser, socketUserId } from 'src/websocket/socket-user';
import { refuseWs } from 'src/websocket/ws-refuse';

/**
 * Single identity check for both transports. Nest builds the websocket
 * guards context without the application config, so globally bound
 * guards never run on gateways: they have to be applied there with an
 * explicit @UseGuards, and this guard has to answer in the exception
 * type each transport expects.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly userService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    return context.getType() === 'ws'
      ? this.authenticateSocket(context)
      : this.authenticateRequest(context);
  }

  /**
   * The socket carries the user bound at handshake time, so no header is
   * parsed here. The database lookup stays: a long lived socket outlives
   * the session that opened it, and this is what rejects a user banned
   * or deleted in the meantime.
   */
  private async authenticateSocket(context: ExecutionContext) {
    const client = context.switchToWs().getClient<Socket>();
    const userId = socketUserId(client);
    const user =
      userId === null ? null : await this.userService.findByUserId(userId);
    if (!user) {
      refuseWs(
        this.logger,
        client,
        'Unauthorized',
        context.switchToWs().getData<unknown>(),
      );
    }
    bindSocketAuthUser(client, user);
    return true;
  }

  private async authenticateRequest(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<Request & { userId: number; user: User }>();
    const userId = extractUserId(request.headers);
    if (userId === null) {
      throw new UnauthorizedException();
    }

    const user = await this.userService.findByUserId(userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    request.userId = userId;
    request.user = user;
    return true;
  }
}
