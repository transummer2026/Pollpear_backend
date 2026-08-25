// permissions/index.ts
import { AbilityBuilder } from '@casl/ability';
import { AppAbility } from '../casl-prisma';
import { AuthorizationUser } from './role';
import { defineUserPermissions } from './user';
import { definePollPermissions } from './poll';
import { defineRoomPermissions } from './room';
import { defineFriendshipPermissions } from './friendship';
import { defineHashtagPermissions } from './hashtag';
import type { UserAbilities } from './user';
import type { PollAbilities } from './poll';
import type { RoomAbilities } from './room';
import type { FriendshipAbilities } from './friendship';
import type { HashtagAbilities } from './hashtag';

export type AppAbilityTuple =
  | UserAbilities
  | PollAbilities
  | RoomAbilities
  | FriendshipAbilities
  | HashtagAbilities;

export const definePermissionsArray: ((
  builder: AbilityBuilder<AppAbility>,
  user: AuthorizationUser,
) => void)[] = [
  defineUserPermissions,
  definePollPermissions,
  defineRoomPermissions,
  defineFriendshipPermissions,
  defineHashtagPermissions,
];
