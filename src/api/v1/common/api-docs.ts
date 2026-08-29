// src/api/v1/common/api-docs.ts
import { applyDecorators } from '@nestjs/common';
import { ApiParam, ApiQuery } from '@nestjs/swagger';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  LIMIT_BY_ROLE,
} from './schemas/api-pagination.schema';

/**
 * Documents the bounds every paginated route enforces, reading them from the
 * schema itself so the two cannot drift apart. Without them a reader sees a
 * plain integer field and only learns the ceiling by being refused.
 */
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
