import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { CaslAbilityFactory } from './casl-ability.factory';
import { User } from 'src/generated/prisma/client';
import { CHECK_POLICIES_KEY } from 'src/common/decorators/check-policies.decorator';
import { PolicyHandler } from './policy-handler.interface';
import { AppAbility } from './casl-prisma';
import { IS_PUBLIC_KEY } from 'src/common/decorators/public.decorator';

/**
 * Runs the policy handlers a route declares through CheckPolicies (usually via
 * CheckAbilities) against the ability built for the caller: the request goes
 * through only if every handler agrees. Registered globally behind AuthGuard
 * and BanGuard, so it always sees an authenticated user; a route marked
 * Public() returns before any policy is looked up, and a route that declares
 * no handler is let through.
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
      .getRequest<Request & { user: User }>(); // set by AuthGuard, which runs first
    return request.user;
  }

  private _getPolicies(context: ExecutionContext): PolicyHandler[] {
    return (
      this.reflector.get<PolicyHandler[]>(
        CHECK_POLICIES_KEY,
        context.getHandler(),
      ) ?? []
    );
  }

  private _execHandler(handler: PolicyHandler, ability: AppAbility): boolean {
    return typeof handler === 'function'
      ? handler(ability)
      : handler.handle(ability);
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

    return policies.every((handler) => this._execHandler(handler, ability));
  }
}
