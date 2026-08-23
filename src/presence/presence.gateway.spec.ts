import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { FriendshipService } from 'src/friendship/friendship.service';
import { WebsocketEmitter } from 'src/websocket/websocket.emitter';
import { PresenceGateway } from './presence.gateway';
import { PresenceService } from './presence.service';

function fakeClient(id: string, userId?: number) {
  const disconnect = jest.fn();
  const socket = { id, data: { userId }, disconnect } as unknown as Socket;
  return { socket, disconnect };
}

function fakeSockets(count: number) {
  return Array.from({ length: count }, (_, index) => ({ id: `s${index}` }));
}

describe('PresenceGateway', () => {
  const setOnline = jest.fn();
  const setOffline = jest.fn();
  const resetAll = jest.fn();
  const presence = {
    setOnline,
    setOffline,
    resetAll,
  } as unknown as PresenceService;
  const friendIds = jest.fn();
  const friendship = { friendIds } as unknown as FriendshipService;
  const toUsers = jest.fn();
  const emitter = { toUsers } as unknown as WebsocketEmitter;
  const fetchSockets = jest.fn();
  const server = { to: jest.fn(() => ({ fetchSockets })) } as unknown as Server;
  let gateway: PresenceGateway;

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new PresenceGateway(presence, friendship, emitter);
    gateway.server = server;
    setOnline.mockResolvedValue(undefined);
    setOffline.mockResolvedValue(undefined);
    friendIds.mockResolvedValue([7, 9]);
  });

  describe('bootstrap', () => {
    it('resets stale online users at startup', async () => {
      resetAll.mockResolvedValue(3);

      await gateway.onApplicationBootstrap();

      expect(resetAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('connection', () => {
    it('marks the user online on their first socket', async () => {
      fetchSockets.mockResolvedValue(fakeSockets(1));

      await gateway.handleConnection(fakeClient('s1', 42).socket);

      expect(setOnline).toHaveBeenCalledWith(42);
      expect(setOffline).not.toHaveBeenCalled();
      expect(toUsers).toHaveBeenCalledWith([7, 9], 'friend:online', {
        userId: 42,
      });
    });

    it('stays silent when another tab of the same user is already open', async () => {
      fetchSockets.mockResolvedValue(fakeSockets(2));

      await gateway.handleConnection(fakeClient('s2', 42).socket);

      expect(setOnline).not.toHaveBeenCalled();
      expect(setOffline).not.toHaveBeenCalled();
      expect(toUsers).not.toHaveBeenCalled();
    });

    it('compensates when every socket vanishes during the online write', async () => {
      fetchSockets
        .mockResolvedValueOnce(fakeSockets(1))
        .mockResolvedValueOnce(fakeSockets(0));

      await gateway.handleConnection(fakeClient('s1', 42).socket);

      expect(setOnline).toHaveBeenCalledWith(42);
      expect(setOffline).toHaveBeenCalledWith(42);
      expect(toUsers).toHaveBeenNthCalledWith(1, [7, 9], 'friend:online', {
        userId: 42,
      });
      expect(toUsers).toHaveBeenNthCalledWith(2, [7, 9], 'friend:offline', {
        userId: 42,
      });
    });

    it('disconnects a socket that was never bound to a user', async () => {
      const { socket, disconnect } = fakeClient('s1', undefined);

      await gateway.handleConnection(socket);

      expect(disconnect).toHaveBeenCalledWith(true);
      expect(fetchSockets).not.toHaveBeenCalled();
      expect(setOnline).not.toHaveBeenCalled();
    });

    it('keeps the connection alive when the presence write fails', async () => {
      fetchSockets.mockResolvedValue(fakeSockets(1));
      setOnline.mockRejectedValue(new Error('db down'));
      const { socket, disconnect } = fakeClient('s1', 42);

      await expect(gateway.handleConnection(socket)).resolves.toBeUndefined();

      expect(disconnect).not.toHaveBeenCalled();
      expect(toUsers).not.toHaveBeenCalled();
    });

    it('still compensates when the friends lookup fails', async () => {
      fetchSockets
        .mockResolvedValueOnce(fakeSockets(1))
        .mockResolvedValueOnce(fakeSockets(0));
      friendIds.mockRejectedValue(new Error('db down'));
      const { socket, disconnect } = fakeClient('s1', 42);

      await expect(gateway.handleConnection(socket)).resolves.toBeUndefined();

      expect(setOnline).toHaveBeenCalledWith(42);
      expect(setOffline).toHaveBeenCalledWith(42);
      expect(disconnect).not.toHaveBeenCalled();
      expect(toUsers).not.toHaveBeenCalled();
    });
  });

  describe('disconnection', () => {
    it('marks the user offline when their last socket closes', async () => {
      fetchSockets.mockResolvedValue(fakeSockets(0));

      await gateway.handleDisconnect(fakeClient('s1', 42).socket);

      expect(setOffline).toHaveBeenCalledWith(42);
      expect(setOnline).not.toHaveBeenCalled();
      expect(toUsers).toHaveBeenCalledWith([7, 9], 'friend:offline', {
        userId: 42,
      });
    });

    it('keeps the user online while other tabs remain open', async () => {
      fetchSockets.mockResolvedValue(fakeSockets(1));

      await gateway.handleDisconnect(fakeClient('s1', 42).socket);

      expect(setOffline).not.toHaveBeenCalled();
      expect(toUsers).not.toHaveBeenCalled();
    });

    it('compensates when a socket reconnects during the offline write', async () => {
      fetchSockets
        .mockResolvedValueOnce(fakeSockets(0))
        .mockResolvedValueOnce(fakeSockets(1));

      await gateway.handleDisconnect(fakeClient('s1', 42).socket);

      expect(setOffline).toHaveBeenCalledWith(42);
      expect(setOnline).toHaveBeenCalledWith(42);
      expect(toUsers).toHaveBeenNthCalledWith(1, [7, 9], 'friend:offline', {
        userId: 42,
      });
      expect(toUsers).toHaveBeenNthCalledWith(2, [7, 9], 'friend:online', {
        userId: 42,
      });
    });

    it('ignores a disconnect from a socket that was never bound', async () => {
      await gateway.handleDisconnect(fakeClient('ghost', undefined).socket);

      expect(fetchSockets).not.toHaveBeenCalled();
      expect(setOffline).not.toHaveBeenCalled();
    });

    it('keeps the connection alive when the offline write fails', async () => {
      fetchSockets.mockResolvedValue(fakeSockets(0));
      setOffline.mockRejectedValue(new Error('db down'));

      await expect(
        gateway.handleDisconnect(fakeClient('s1', 42).socket),
      ).resolves.toBeUndefined();
    });
  });
});
