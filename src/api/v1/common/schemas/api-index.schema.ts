// src/api/v1/common/schemas/api-index.schema.ts
import { z } from 'zod';

export const ApiIndexSchema = z.object({
  version: z.string(),
  docs: z.string(),
  resources: z.array(z.string()),
});

export type ApiIndexDTO = z.infer<typeof ApiIndexSchema>;
