import { z } from 'zod';

/**
 * Une echeance ne se pose que devant soi. Partagee entre les ressources qui
 * en portent une, pour qu'un sondage et une room refusent la meme chose.
 */
export const endsInTheFuture = () =>
  z.coerce.date().refine((date) => date.getTime() > Date.now(), {
    error: 'endsAt must be in the future',
  });
