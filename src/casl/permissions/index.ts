import { AbilityBuilder } from '@casl/ability';
import { AppAbility } from '../casl-prisma';
import { AuthorizationUser } from './role';
import { defineUserPermissions } from './user';
import { definePollPermissions } from './poll';
import { defineRoomPermissions } from './room';
import { defineFriendshipPermissions } from './friendship';
import { defineHashtagPermissions } from './hashtag';
import { defineVotePermissions } from './vote';
import { defineBlockPermissions } from './block';
import { defineBanPermissions } from './ban';
import { defineInvitationPermissions } from './invitation';
import { defineMessagePermissions } from './message';
import type { UserAbilities } from './user';
import type { PollAbilities } from './poll';
import type { RoomAbilities } from './room';
import type { FriendshipAbilities } from './friendship';
import type { HashtagAbilities } from './hashtag';
import type { VoteAbilities } from './vote';
import type { BlockAbilities } from './block';
import type { BanAbilities } from './ban';
import type { InvitationAbilities } from './invitation';
import type { MessageAbilities } from './message';

export type AppAbilityTuple =
  | UserAbilities
  | PollAbilities
  | RoomAbilities
  | FriendshipAbilities
  | HashtagAbilities
  | VoteAbilities
  | BlockAbilities
  | BanAbilities
  | InvitationAbilities
  | MessageAbilities;

export const definePermissionsArray: ((
  builder: AbilityBuilder<AppAbility>,
  user: AuthorizationUser,
) => void)[] = [
  defineUserPermissions,
  definePollPermissions,
  defineRoomPermissions,
  defineFriendshipPermissions,
  defineHashtagPermissions,
  defineVotePermissions,
  defineBlockPermissions,
  defineBanPermissions,
  defineInvitationPermissions,
  defineMessagePermissions,
];
