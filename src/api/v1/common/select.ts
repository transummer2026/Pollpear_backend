import { z } from 'zod';

export function selectOf<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
): Record<keyof z.infer<T>, true> {
  return Object.fromEntries(
    Object.keys(schema.shape).map((field) => [field, true]),
  ) as Record<keyof z.infer<T>, true>;
}

/**
 * Fails the build when a payload promises a column the model does not have.
 * It has no runtime job, so each user of it holds the result in an exported
 * const: exported only because a plain local would read as dead code to the
 * linter, and to a reviewer.
 */
export type AssertColumns<DTO, Model> =
  Exclude<keyof DTO, keyof Model> extends never
    ? true
    : Exclude<keyof DTO, keyof Model>;
