import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, Socket } from 'socket.io';
import { VaultService } from 'src/vault/vault.service';
import { WebsocketAdapter } from './websocket.adapter';
import { bindSocketUser, socketUserId, userChannel } from './socket-user';

type Middleware = (socket: Socket, next: (error?: Error) => void) => void;
type ConnectionListener = (socket: Socket) => void;

function fakeSocket(headers: Record<string, string> = {}) {
  const join = jest.fn();
  const socket = {
    id: 'socket-1',
    handshake: { headers },
    data: {},
    join,
  } as unknown as Socket;
  return { socket, join };
}

describe('WebsocketAdapter', () => {
  const use = jest.fn<void, [Middleware]>();
  const on = jest.fn<void, [string, ConnectionListener]>();
  const server = {
    use,
    on,
    engine: { on: jest.fn() },
  } as unknown as Server;
  const appContext = {
    get: () => ({
      ws: {
        path: '/ws',
        ping_interval: '25000',
        ping_timeout: '20000',
        max_payload: '1000000',
      },
    }),
  } as unknown as INestApplicationContext;

  let authenticate: Middleware;
  let onConnection: ConnectionListener;

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(IoAdapter.prototype, 'createIOServer')
      .mockReturnValue(server as never);
    new WebsocketAdapter(appContext).createIOServer(3000);
    authenticate = use.mock.calls[0][0];
    onConnection = on.mock.calls.find(([event]) => event === 'connection')![1];
  });

  it('reads the ws config from Vault at construction', () => {
    const get = jest.fn().mockReturnValue({ ws: { path: '/ws' } });

    new WebsocketAdapter({ get } as unknown as INestApplicationContext);

    expect(get).toHaveBeenCalledWith(VaultService);
  });

  it('applies the Vault config to the socket.io server', () => {
    const createIOServer = jest.spyOn(IoAdapter.prototype, 'createIOServer');

    expect(createIOServer).toHaveBeenCalledWith(
      3000,
      expect.objectContaining({
        path: '/ws',
        pingInterval: 25000,
        maxHttpBufferSize: 1000000,
      }),
    );
  });

  describe('authentication', () => {
    it('binds the user carried by the handshake', () => {
      const { socket } = fakeSocket({ 'x-user-id': '42' });
      const next = jest.fn();

      authenticate(socket, next);

      expect(socketUserId(socket)).toBe(42);
      expect(next).toHaveBeenCalledWith();
    });

    it('refuses a handshake without x-user-id', () => {
      const { socket } = fakeSocket();
      const next = jest.fn();

      authenticate(socket, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(socketUserId(socket)).toBeNull();
    });

    it.each(['0', '-1', '1.5', 'abc'])(
      'refuses an invalid x-user-id %p',
      (value) => {
        const { socket } = fakeSocket({ 'x-user-id': value });
        const next = jest.fn();

        authenticate(socket, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
      },
    );
  });

  describe('user channel subscription', () => {
    it('joins the channel every broadcast addresses', () => {
      const { socket, join } = fakeSocket();
      bindSocketUser(socket, 42);

      onConnection(socket);

      expect(join).toHaveBeenCalledWith(userChannel(42));
    });

    it('subscribes before nest binds the gateways', () => {
      const createIOServerCalls = jest.spyOn(
        IoAdapter.prototype,
        'createIOServer',
      ).mock.calls.length;

      expect(createIOServerCalls).toBeGreaterThan(0);
      expect(on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('joins nothing for an unbound socket', () => {
      const { socket, join } = fakeSocket();

      onConnection(socket);

      expect(join).not.toHaveBeenCalled();
    });
  });
});
