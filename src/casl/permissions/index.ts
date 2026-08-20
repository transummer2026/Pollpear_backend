// permissions/index.ts
import { AbilityBuilder } from '@casl/ability';
import { AppAbility } from '../casl-prisma';
import { AuthorizationUser } from './role';
import { defineUserPermissions } from './user';
import { definePollPermissions } from './poll';
import { defineRoomPermissions } from './room';
import type { UserAbilities } from './user';
import type { PollAbilities } from './poll';
import type { RoomAbilities } from './room';

export type AppAbilityTuple = UserAbilities | PollAbilities | RoomAbilities;

export const definePermissionsArray: ((
  builder: AbilityBuilder<AppAbility>,
  user: AuthorizationUser,
) => void)[] = [
  defineUserPermissions,
  definePollPermissions,
  defineRoomPermissions,
];
