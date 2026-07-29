import { PolicyHandler } from 'src/casl/policy-handler.interface';
import { SetMetadata } from '@nestjs/common';

//spread opertor expands elements in an array into individual places
//it collects all arguments into an array. A bit like variadic functions
//I will. call the checkPolicies guard

export const CHECK_POLICIES_KEY = 'check_policy';
export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);
