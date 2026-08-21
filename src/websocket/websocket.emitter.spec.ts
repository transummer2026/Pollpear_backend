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

  it('sends an event to every listed user room at once', () => {
    const emitter = new WebsocketEmitter();
    emitter.server = server;

    emitter.toUsers([7, 9], 'friend:online', { userId: 42 });

    expect(to).toHaveBeenCalledWith(['user:7', 'user:9']);
    expect(emit).toHaveBeenCalledWith('friend:online', { userId: 42 });
  });

  it('stays silent for an empty recipient list', () => {
    const emitter = new WebsocketEmitter();
    emitter.server = server;

    emitter.toUsers([], 'friend:online', { userId: 42 });

    expect(to).not.toHaveBeenCalled();
  });

  it('drops a multi-user event before the server is ready', () => {
    const emitter = new WebsocketEmitter();

    expect(() => emitter.toUsers([7], 'friend:online')).not.toThrow();
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
