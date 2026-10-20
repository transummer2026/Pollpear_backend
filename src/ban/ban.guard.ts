import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { BanService } from './ban.service';
import { Reflector } from '@nestjs/core';
import { type Request } from 'express';
import { VISIBLE_BY_BAN } from '../common/decorators/ban.decorator';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';

/**
 * Cuts a banned account off from the whole API, whatever the route's own
 * rights. Runs after AuthGuard, which is what puts `userId` on the request.
 *
 * Two ways past it: Public() routes, which have no caller to check, and
 * VisibleByBan() routes — the ones a banned user must still reach, such as
 * reading their own ban.
 */
@Injectable()
export class BanGuard implements CanActivate {
  constructor(
    private readonly banService: BanService,
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

    const userisBanned = await this.banService.findByBanStatus(userId);
    if (userisBanned) {
      throw new ForbiddenException('User is banned.');
    }

    return true;
  }
}
