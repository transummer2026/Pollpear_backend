// src/api/v1/common/select.ts
import { z } from 'zod';

export function selectOf<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
): Record<keyof z.infer<T>, true> {
  return Object.fromEntries(
    Object.keys(schema.shape).map((field) => [field, true]),
  ) as Record<keyof z.infer<T>, true>;
}

export type AssertColumns<DTO, Model> =
  Exclude<keyof DTO, keyof Model> extends never
    ? true
    : Exclude<keyof DTO, keyof Model>;
