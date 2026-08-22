// src/api/v1/common/abilities.ts
import type { AppAbility } from 'src/casl/casl-prisma';

/**
 * The CASL rules speak in actions, the routes speak in what a caller may see.
 * These names are the whole translation, written once: nowhere else in v1
 * should "may this caller see a deleted account" be spelled out as
 * can('manage', 'User'), which says nothing of the sort on its own.
 */
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
