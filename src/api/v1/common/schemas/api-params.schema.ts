import { z } from 'zod';

/**
 * A row id is a positive integer. Refusing 0 and negatives here rather than
 * letting them reach postgres keeps the answer honest: they cannot designate
 * an account, so they are a malformed request, not a missing one.
 */
export const ApiIdParamSchema = z.coerce.number().int().min(1);
