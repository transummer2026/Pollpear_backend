// permissions/index.ts
import { AbilityBuilder } from '@casl/ability';
import { AppAbility } from '../casl-prisma';
import { AuthorizationUser } from './role';
import { defineUserPermissions } from './user';
import { definePollPermissions } from './poll';
import type { UserAbilities } from './user';
import type { PollAbilities } from './poll';

export type AppAbilityTuple = UserAbilities | PollAbilities;

export const definePermissionsArray: ((
  builder: AbilityBuilder<AppAbility>,
  user: AuthorizationUser,
) => void)[] = [defineUserPermissions, definePollPermissions];
