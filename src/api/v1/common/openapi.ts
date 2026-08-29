// src/api/v1/common/openapi.ts
import { z } from 'zod';
import {
  DocumentBuilder,
  type ApiOkResponse,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { apiV1 } from './api-v1';
import type { RateLimitSecrets } from 'src/vault/vault.service';

export const API_KEY_HEADER = 'X-API-Key';
export const OPENAPI_JSON_PATH = '/v1/openapi.json';
export const OPENAPI_DOCS_PATH = '/v1/docs';

const API_KEY_SCHEME = 'apiKey';

type OpenApiSchema = Extract<
  NonNullable<Parameters<typeof ApiOkResponse>[0]>,
  { schema: unknown }
>['schema'];

export function toOpenApi(schema: z.ZodType): OpenApiSchema {
  return z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io: 'output',
    unrepresentable: 'any',
    override: ({ zodSchema, jsonSchema }) => {
      if (zodSchema._zod.def.type === 'date') {
        jsonSchema.type = 'string';
        jsonSchema.format = 'date-time';
      }
    },
  }) as OpenApiSchema;
}

export function describeApiV1(publicUrl: string) {
  return new DocumentBuilder()
    .addServer(publicUrl)
    .setTitle('Pollpear public API')
    .setDescription(apiV1.resources.join(', '))
    .setVersion(apiV1.version)
    .addApiKey(
      { type: 'apiKey', name: API_KEY_HEADER, in: 'header' },
      API_KEY_SCHEME,
    )
    .addSecurityRequirements(API_KEY_SCHEME)
    .build();
}

const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const;

function rateLimited({ limit, window_seconds }: RateLimitSecrets) {
  return {
    description:
      `Too many requests. The api allows ${limit} calls per api key per ` +
      `${window_seconds}s across every v1 route, and answers with an empty ` +
      `body. No Retry-After header is sent: retry after ${window_seconds}s.`,
  };
}

export function documentRateLimit(
  document: OpenAPIObject,
  rateLimit: RateLimitSecrets,
): OpenAPIObject {
  const response = rateLimited(rateLimit);

  for (const path of Object.values(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = path[method];
      if (operation) {
        operation.responses = { ...operation.responses, '429': response };
      }
    }
  }

  return document;
}
