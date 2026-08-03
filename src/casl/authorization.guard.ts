import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { CaslAbilityFactory } from './casl-ability.factory/casl-ability.factory';
import { User } from 'src/generated/prisma/client';
import { CHECK_ABILITY } from 'src/common/decorators/check-ability.decorator';
import { AppAbilityTuple } from './permissions';
import { IS_PUBLIC_KEY } from 'src/common/decorators/public.decorator';

/**
 * PolicyHnadlers is an array of handler assigned to
 */
@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  private _getUser(context: ExecutionContext): User {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: User }>(); // set by your auth guard / strategy
    return request.user;
  }

  private _getPolicies(context: ExecutionContext): AppAbilityTuple[] {
    return (
      this.reflector.get<AppAbilityTuple[]>(
        CHECK_ABILITY,
        context.getHandler(),
      ) ?? []
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const user = this._getUser(context);
    const policies = this._getPolicies(context);

    const ability = this.abilityFactory.createForUser(user);

    return policies.every((policy) => ability.can(...policy));
  }
}
