import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { Reflector } from '@nestjs/core';
import { type Request } from 'express';
import { VISIBLE_BY_BAN } from '../common/decorators/ban.decorator';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';

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
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const isVisibleByBan = this.reflector.getAllAndOverride<boolean>(
      VISIBLE_BY_BAN,
      [context.getHandler(), context.getClass()],
    );
    if (isVisibleByBan) {
      return true;
    }
    const request = context
      .switchToHttp()
      .getRequest<Request & { userId?: number }>();

    const userId = request.userId;
    if (!userId) throw new ForbiddenException('No user id.');

    const userisBanned = await this.userService.findByBanStatus(userId);
    if (userisBanned) {
      throw new ForbiddenException('User is banned.');
    }

    return true;
  }
}
//TODO: potentially change the code here with the optimisation inside the auth guard that makes a user available
