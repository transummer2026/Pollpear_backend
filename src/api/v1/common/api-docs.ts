// src/api/v1/common/api-docs.ts
import { applyDecorators } from '@nestjs/common';
import { ApiParam, ApiQuery } from '@nestjs/swagger';
import type { z } from 'zod';
import { toOpenApi } from './openapi';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  LIMIT_BY_ROLE,
} from './schemas/api-pagination.schema';

export function ApiPageQueryDocs() {
  return applyDecorators(
    ApiQuery({
      name: 'page',
      required: false,
      description:
        'A page past the last one is refused, not answered empty. Page 1 always answers.',
      schema: { type: 'integer', minimum: 1, default: DEFAULT_PAGE },
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      description: `Rows per page, capped by the role of the key: ${LIMIT_BY_ROLE.user} for a user, ${LIMIT_BY_ROLE.moderator} for a moderator, ${LIMIT_BY_ROLE.admin} for an admin. Above your own cap the call is refused, never trimmed.`,
      schema: {
        type: 'integer',
        minimum: 1,
        maximum: LIMIT_BY_ROLE.admin,
        default: DEFAULT_LIMIT,
      },
    }),
  );
}

export function ApiIdParamDocs(description: string) {
  return ApiParam({
    name: 'id',
    required: true,
    description,
    schema: { type: 'integer', minimum: 1 },
  });
}

export function ApiFilterDocs(schema: z.ZodObject<z.ZodRawShape>) {
  const { properties } = toOpenApi(schema) as {
    properties?: Record<string, Record<string, unknown>>;
  };

  return applyDecorators(
    ...Object.entries(properties ?? {}).map(([name, property]) =>
      ApiQuery({ name, required: false, schema: property }),
    ),
  );
}
