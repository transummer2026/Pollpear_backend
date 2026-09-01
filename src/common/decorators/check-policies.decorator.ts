import { PolicyHandler } from 'src/casl/policy-handler.interface';
import { SetMetadata } from '@nestjs/common';

export const CHECK_POLICIES_KEY = 'check_policy';

/**
 * Stores the policy handlers a route requires as route metadata, which
 * AuthorizationGuard reads back and runs against the caller's ability: all of
 * them have to answer true for the request to go through. Most routes declare
 * them through CheckAbilities rather than writing handlers by hand.
 */
export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);
