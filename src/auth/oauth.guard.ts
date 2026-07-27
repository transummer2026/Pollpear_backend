import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { type Request } from 'express';
import { OauthProvider, User } from 'src/generated/prisma/client';

const WIRED_PROVIDERS: string[] = [OauthProvider.school42];

@Injectable()
export class OauthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: User; userId?: string }>();
    const rawProvider = request.params.provider;
    const provider = Array.isArray(rawProvider) ? rawProvider[0] : rawProvider;
    if (!provider || !WIRED_PROVIDERS.includes(provider)) {
      throw new NotFoundException(`Unknown oauth provider: ${provider}`);
    }
    const guard = new (PassportAuthGuard(provider))();
    const allowed = await (guard.canActivate(context) as Promise<boolean>);
    if (allowed && request.user) {
      request.userId = String(request.user.id);
    }
    return allowed;
  }
}
