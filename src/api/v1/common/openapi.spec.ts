import type { OpenAPIObject } from '@nestjs/swagger';
import type { RateLimitSecrets } from 'src/vault/vault.service';
import { documentRateLimit } from './openapi';

const RATE_LIMIT: RateLimitSecrets = { limit: '100', window_seconds: '60' };

type Documented = { description: string };

function documentWith(paths: OpenAPIObject['paths']): OpenAPIObject {
  return { openapi: '3.0.0', info: { title: 't', version: 'v1' }, paths };
}

describe('documentRateLimit', () => {
  it('stamps every operation the gateway meters', () => {
    const document = documentRateLimit(
      documentWith({
        '/v1/me': {
          get: { responses: { '200': { description: 'ok' } } },
          patch: { responses: { '200': { description: 'ok' } } },
          delete: { responses: { '204': { description: 'gone' } } },
        },
        '/v1/me/avatar': {
          post: { responses: { '200': { description: 'ok' } } },
        },
      }),
      RATE_LIMIT,
    );

    for (const path of Object.values(document.paths)) {
      for (const operation of Object.values(path)) {
        expect(operation).toHaveProperty(['responses', '429']);
      }
    }
  });

  it('leaves the responses a route already documents alone', () => {
    const document = documentRateLimit(
      documentWith({
        '/v1/me': {
          get: {
            responses: {
              '200': { description: 'ok' },
              '403': { description: 'denied' },
            },
          },
        },
      }),
      RATE_LIMIT,
    );

    expect(Object.keys(document.paths['/v1/me'].get!.responses).sort()).toEqual(
      ['200', '403', '429'],
    );
  });

  /**
   * A path item carries keys that are not operations. Walking them as if
   * they were would write a `responses` object onto a string.
   */
  it('never touches a path key that is not an operation', () => {
    const document = documentRateLimit(
      documentWith({
        '/v1/me': {
          summary: 'the caller account',
          parameters: [],
          get: { responses: { '200': { description: 'ok' } } },
        },
      }),
      RATE_LIMIT,
    );

    expect(document.paths['/v1/me'].summary).toBe('the caller account');
    expect(document.paths['/v1/me'].parameters).toEqual([]);
  });

  /**
   * The figures are operational configuration. Reading them from the same
   * vault secret the gateway enforces is what keeps the documented ceiling
   * and the enforced one from drifting apart.
   */
  it('documents the ceiling and window vault holds, not a copy of them', () => {
    const document = documentRateLimit(
      documentWith({
        '/v1/me': { get: { responses: { '200': { description: 'ok' } } } },
      }),
      { limit: '7', window_seconds: '900' },
    );

    const { description } = document.paths['/v1/me'].get!.responses[
      '429'
    ] as Documented;

    expect(description).toContain('7 calls');
    expect(description).toContain('900s');
  });

  /**
   * Scalar is served to anyone holding a key, so the 429 says what a
   * caller must do and nothing about what runs behind it. Naming the
   * counting scheme would publish how to straddle two windows for twice
   * the ceiling; naming the proxy maps the topology for free.
   */
  it('keeps the machinery behind the limit out of the public document', () => {
    const document = documentRateLimit(
      documentWith({
        '/v1/me': { get: { responses: { '200': { description: 'ok' } } } },
      }),
      RATE_LIMIT,
    );

    const { description } = document.paths['/v1/me'].get!.responses[
      '429'
    ] as Documented;

    expect(description).not.toMatch(
      /gateway|proxy|redis|sliding|fixed|counter|window starts/i,
    );
  });
});
