// src/api/v1/common/abilities.ts
import type { AppAbility } from 'src/casl/casl-prisma';

export function isAdmin(ability: AppAbility): boolean {
  return ability.can('manage', 'User');
}

export function isStaff(ability: AppAbility): boolean {
  return ability.can('moderate', 'User');
}

export function canSeeBannedAccounts(ability: AppAbility): boolean {
  return isStaff(ability);
}

export function canSeeDeletedAccounts(ability: AppAbility): boolean {
  return isAdmin(ability);
}

export function canSeeEveryPoll(ability: AppAbility): boolean {
  return ability.can('moderate', 'Poll');
}

export function canSeeDeletedPolls(ability: AppAbility): boolean {
  return isAdmin(ability);
}
