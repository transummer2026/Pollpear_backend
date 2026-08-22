// src/api/v1/common/bans.ts
import type { Prisma } from 'src/generated/prisma/client';

/**
 * A ban still in force: its term has not passed, and nobody lifted it. Both
 * halves matter. A moderator who unbans early leaves endedAt in the future,
 * so a term on its own would keep an account hidden after its sentence was
 * cancelled. Written here because the listing filter, the profile filter and
 * the moderation counts must all agree on what being banned means.
 */
export function activeBan(): Prisma.BanWhereInput {
  return { endedAt: { gt: new Date() }, unbannedById: null };
}

/**
 * A ban a moderator ended by hand, as opposed to one that simply ran out.
 */
export function liftedBan(): Prisma.BanWhereInput {
  return { unbannedById: { not: null } };
}
