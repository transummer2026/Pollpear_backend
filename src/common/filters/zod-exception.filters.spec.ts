import { ArgumentsHost, Logger } from '@nestjs/common';
import { z } from 'zod';
import { ZodExceptionFilter } from './zod-exception.filters';

function zodError() {
  const result = z
    .object({ inviter: z.object({ id: z.number() }) })
    .safeParse({});
  if (result.success) throw new Error('expected the parse to fail');
  return result.error;
}

describe('ZodExceptionFilter', () => {
  let captured: unknown;
  const json = jest.fn((body: unknown) => {
    captured = body;
  });
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status, json }) }),
  } as unknown as ArgumentsHost;
  const filter = new ZodExceptionFilter();

  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  beforeEach(() => {
    jest.clearAllMocks();
    captured = undefined;
  });

  it('answers 500 with an opaque body', () => {
    filter.catch(zodError(), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      message: 'Internal server error',
      statusCode: 500,
    });
  });

  it('never leaks the failing schema paths into the response', () => {
    filter.catch(zodError(), host);

    expect(JSON.stringify(captured)).not.toContain('inviter');
  });
});
