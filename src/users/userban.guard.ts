import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { Reflector } from '@nestjs/core';
import { type Request } from 'express';
import { IS_VISIBLE_BY_BAN_KEY } from './visibleByBan.decorator';

/**
 * in the guard you spcify what capacity it has, which is why you retype the
 * request
 */
@Injectable()
export class BanGuard implements CanActivate {
  constructor(
    private readonly userService: UsersService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isVisibleByBan = this.reflector.getAllAndOverride<boolean>(
      IS_VISIBLE_BY_BAN_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isVisibleByBan) {
      return true;
    }
    const request = context
      .switchToHttp()
      .getRequest<Request & { userId?: string }>();

    const userId = request.userId;
    if (!userId) throw new ForbiddenException('No user id.');

    const userIdNum = Number(userId);
    if (Number.isNaN(userIdNum))
      throw new ForbiddenException('Invalid user id.');

    const userisBanned = await this.userService.findByBanStatus(userIdNum);
    if (userisBanned) {
      throw new ForbiddenException('User is banned.');
    }

    return true;
  }
}
//TODO: potentially change the code here with the optimisation inside the auth guard that makes a user available
