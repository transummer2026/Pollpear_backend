import { AppAbilityTuple } from 'src/casl/permissions';
import { CheckPolicies } from './check-policies.decorator';
import { AppAbility } from 'src/casl/casl-prisma';

export const CheckAbilities = (...abilities: AppAbilityTuple[]) =>
  CheckPolicies(
    ...abilities.map(
      ([action, subject]) =>
        (ability: AppAbility) =>
          ability.can(action, subject),
    ),
  );
