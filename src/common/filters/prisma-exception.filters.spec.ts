import { ArgumentsHost, Logger } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filters';

describe('PrismaExceptionFilter', () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status, json }) }),
  } as unknown as ArgumentsHost;
  const filter = new PrismaExceptionFilter();

  function prismaError(code: string) {
    return new Prisma.PrismaClientKnownRequestError('raw database detail', {
      code,
      clientVersion: '7.8.0',
    });
  }

  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  beforeEach(() => jest.clearAllMocks());

  it.each<[string, number, string, string]>([
    ['P2000', 400, 'Bad Request', 'Invalid input data.'],
    ['P2002', 409, 'Conflict', 'Resource already exists.'],
    ['P2003', 400, 'Bad Request', 'Invalid reference.'],
    ['P2025', 404, 'Not Found', 'Resource not found.'],
  ])(
    'maps %s to a %i response, raw prisma message hidden',
    (code, statusCode, error, message) => {
      filter.catch(prismaError(code), host);

      expect(status).toHaveBeenCalledWith(statusCode);
      expect(json).toHaveBeenCalledWith({ error, message, statusCode });
    },
  );

  it('hides unknown codes behind a 500 database error', () => {
    filter.catch(prismaError('P2999'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      message: 'Database error',
      statusCode: 500,
    });
  });
});
