import { ArgumentsHost, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { WsExceptionsFilter } from './ws-exceptions.filter';

function wsHost(emit: jest.Mock): ArgumentsHost {
  return {
    switchToWs: () => ({
      getClient: () => ({ id: 'socket-1', emit }),
      getData: () => ({}),
      getPattern: () => 'test:event',
    }),
  } as unknown as ArgumentsHost;
}

describe('WsExceptionsFilter', () => {
  const filter = new WsExceptionsFilter();
  const emit = jest.fn();

  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  beforeEach(() => jest.clearAllMocks());

  it('lets a WsException reach the client unchanged', () => {
    filter.catch(new WsException('Not a room member'), wsHost(emit));

    expect(emit).toHaveBeenCalledWith(
      'exception',
      expect.objectContaining({
        status: 'error',
        message: 'Not a room member',
      }),
    );
  });

  it('hides internal errors behind an opaque message', () => {
    filter.catch(new Error('prisma exploded'), wsHost(emit));

    expect(emit).toHaveBeenCalledWith(
      'exception',
      expect.objectContaining({
        status: 'error',
        message: 'Internal server error',
      }),
    );
    const sent = JSON.stringify(emit.mock.calls);
    expect(sent).not.toContain('prisma exploded');
  });

  it('handles non-Error throws the same way', () => {
    filter.catch('boom', wsHost(emit));

    expect(emit).toHaveBeenCalledWith(
      'exception',
      expect.objectContaining({
        status: 'error',
        message: 'Internal server error',
      }),
    );
  });
});
