import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { CaslAbilityFactory } from './casl-ability.factory/casl-ability.factory';
import { CHECK_POLICIES_KEY } from 'src/common/decorators/check-policies.decorator';
import { PolicyHandler } from './policy-handler.interface';
import { User } from 'src/generated/prisma/client';
import { AppAbility } from './casl-prisma';
import { IS_PUBLIC_KEY } from 'src/common/decorators/public.decorator';
/**
 * PolicyHnadlers is an array of handler assigned to
 */
@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private casAbilityFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const policyHandlers =
      this.reflector.get<PolicyHandler[]>(
        CHECK_POLICIES_KEY,
        context.getHandler(),
      ) || [];
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: User }>();

    const ability = this.casAbilityFactory.createForUser(request.user);

    return policyHandlers.every((handler) =>
      this.execPolicyHandler(handler, ability),
    );
  }

  private execPolicyHandler(handler: PolicyHandler, ability: AppAbility) {
    if (typeof handler == 'function') {
      return handler(ability);
    }
    return handler.handle(ability);
  }
}
