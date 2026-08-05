import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { type Request } from 'express';
import { OauthProvider } from 'src/generated/prisma/client';
import { type OauthLoginResult } from './oauth.service';

const WIRED_PROVIDERS: string[] = [
  OauthProvider.school42,
  OauthProvider.google,
  OauthProvider.github,
];

@Injectable()
export class OauthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: OauthLoginResult; userId?: number }>();
    const rawProvider = request.params.provider;
    const provider = Array.isArray(rawProvider) ? rawProvider[0] : rawProvider;
    if (!provider || !WIRED_PROVIDERS.includes(provider)) {
      throw new NotFoundException(`Unknown oauth provider: ${provider}`);
    }
    const guard = new (PassportAuthGuard(provider))();
    const allowed = await (guard.canActivate(context) as Promise<boolean>);
    if (allowed && request.user?.status === 'user') {
      request.userId = request.user.user.id;
    }
    return allowed;
  }
}
