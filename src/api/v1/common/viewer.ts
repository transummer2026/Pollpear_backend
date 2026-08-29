// src/api/v1/common/viewer.ts
import type { User } from 'src/generated/prisma/client';

/**
 * Ce qu'un chemin de lecture doit encore savoir de l'appelant une fois la
 * portee deleguee a accessibleBy : son id, pour reconnaitre les comptes qu'il
 * a lui-meme bloques. Tout le reste est decide par la politique.
 */
export type Viewer = {
  id: number;
};

export function viewerOf(user: User): Viewer {
  return { id: user.id };
}
