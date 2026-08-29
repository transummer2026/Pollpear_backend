// src/api/v1/users/users.visibility.ts
import { publicMedia } from '../common/media';
import type { ApiUserStateDTO } from '../common/schemas/api-users.schema';

/**
 * La colonne lue pour decider l'etat, jamais renvoyee telle quelle. Le filtre
 * porte sur le seul blocage que l'appelant a lui-meme pose : la politique
 * ecarte deja de la liste les comptes qui l'ont bloque, lui, et il n'a donc
 * aucun moyen d'en deduire quoi que ce soit.
 */
export const VIEWER_SELECT = (viewerId: number) => ({
  blocksReceived: {
    where: { blockerId: viewerId },
    select: { id: true },
    take: 1,
  },
});

type StateColumns = {
  blocksReceived: { id: number }[];
};

/**
 * Un seul etat reste possible. Supprime et prive ne sont pas des etats a
 * signaler : accessibleBy les ecarte de la reponse, donc un compte dans cette
 * situation n'arrive jamais jusqu'ici.
 */
export function stateOf(row: StateColumns): ApiUserStateDTO | undefined {
  return row.blocksReceived.length > 0 ? 'blocked' : undefined;
}

/**
 * Turns a row read with VIEWER_SELECT into what a payload may carry: the
 * bookkeeping column becomes a state, and a media path that is not a public
 * url becomes null. Both list and profile go through here, so a caller can
 * never be told more on one route than on the other.
 */
export function presentUser<
  Row extends StateColumns & { avatarUrl: string | null },
>(row: Row) {
  const { blocksReceived, ...columns } = row;
  return {
    ...columns,
    avatarUrl: publicMedia(row.avatarUrl),
    state: stateOf({ blocksReceived }),
  };
}
