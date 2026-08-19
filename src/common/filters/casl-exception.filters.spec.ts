import { createMongoAbility, ForbiddenError } from '@casl/ability';
import { ArgumentsHost, Logger } from '@nestjs/common';
import { AppAbility } from '../../casl/casl-prisma';
import { CaslExceptionFilter } from './casl-exception.filters';

function caslError(message: string) {
  return ForbiddenError.from(createMongoAbility([])).setMessage(
    message,
  ) as unknown as ForbiddenError<AppAbility>;
}

describe('CaslExceptionFilter', () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status, json }) }),
  } as unknown as ArgumentsHost;
  const filter = new CaslExceptionFilter();

  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  beforeEach(() => jest.clearAllMocks());

  it('answers 403 with an opaque access denied body', () => {
    filter.catch(caslError('Cannot execute "delete" on "User"'), host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      error: 'Forbidden',
      message: 'Access denied',
      statusCode: 403,
    });
  });

  it('sends the same opaque body whatever the casl message says', () => {
    filter.catch(caslError('secret rule detail'), host);

    expect(json).toHaveBeenCalledWith({
      error: 'Forbidden',
      message: 'Access denied',
      statusCode: 403,
    });
  });
});
