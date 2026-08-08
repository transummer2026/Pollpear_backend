import { Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { WebsocketEmitter } from './websocket.emitter';

describe('WebsocketEmitter', () => {
  const emit = jest.fn();
  const disconnectSockets = jest.fn();
  const fetchSockets = jest.fn();
  const to = jest
    .fn()
    .mockReturnValue({ emit, fetchSockets, disconnectSockets });
  const server = { to } as unknown as Server;

  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  beforeEach(() => jest.clearAllMocks());

  it('does nothing before the server is ready', async () => {
    const emitter = new WebsocketEmitter();

    expect(() => emitter.toUser(42, 'some:event')).not.toThrow();
    await expect(emitter.revokeUser(42)).resolves.toBeUndefined();
  });

  it('sends an event to the user room', () => {
    const emitter = new WebsocketEmitter();
    emitter.server = server;

    emitter.toUser(42, 'some:event', { a: 1 });

    expect(to).toHaveBeenCalledWith('user:42');
    expect(emit).toHaveBeenCalledWith('some:event', { a: 1 });
  });

  it('revokes every socket of the user', async () => {
    const emitter = new WebsocketEmitter();
    emitter.server = server;
    fetchSockets.mockResolvedValue([{ id: 'socket-1' }, { id: 'socket-2' }]);

    await emitter.revokeUser(42);

    expect(emit).toHaveBeenCalledWith('session:revoked');
    expect(disconnectSockets).toHaveBeenCalledWith(true);
  });

  it('does not emit when the user has no open socket', async () => {
    const emitter = new WebsocketEmitter();
    emitter.server = server;
    fetchSockets.mockResolvedValue([]);

    await emitter.revokeUser(42);

    expect(emit).not.toHaveBeenCalled();
    expect(disconnectSockets).not.toHaveBeenCalled();
  });
});
