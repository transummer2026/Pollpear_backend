// src/api/v1/common/viewer.ts
import type { User } from 'src/generated/prisma/client';
import type { AppAbility } from 'src/casl/casl-prisma';
import { canSeeBannedAccounts, canSeeDeletedAccounts } from './abilities';

/**
 * Everything a read path needs to know about who is asking: an id to measure
 * blocks against, and what that account is entitled to see. Built once per
 * request so the two flags always travel together — passed loose they are two
 * adjacent booleans of the same type, which nothing stops anyone inverting.
 */
export type Viewer = {
  id: number;
  canSeeBanned: boolean;
  canSeeDeleted: boolean;
};

export function viewerOf(user: User, ability: AppAbility): Viewer {
  return {
    id: user.id,
    canSeeBanned: canSeeBannedAccounts(ability),
    canSeeDeleted: canSeeDeletedAccounts(ability),
  };
}
