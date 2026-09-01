import { z } from 'zod';

/**
 * A deadline can only be set ahead of now. Shared by every resource that
 * carries one, so a poll and a room refuse the same thing.
 */
export const endsInTheFuture = () =>
  z.coerce.date().refine((date) => date.getTime() > Date.now(), {
    error: 'endsAt must be in the future',
  });
