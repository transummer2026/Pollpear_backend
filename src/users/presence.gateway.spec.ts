import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { PrismaService } from 'src/prisma/prisma.service';
import { PresenceGateway } from './presence.gateway';

function fakeClient(id: string, userId?: number) {
  const join = jest.fn().mockResolvedValue(undefined);
  const disconnect = jest.fn();
  const socket = {
    id,
    data: { userId },
    join,
    disconnect,
  } as unknown as Socket;
  return { socket, join, disconnect };
}

describe('PresenceGateway', () => {
  const prisma = {
    user: { update: jest.fn(), updateMany: jest.fn() },
    friendship: { findMany: jest.fn() },
  };
  const emit = jest.fn();
  const serverTo = jest.fn().mockReturnValue({ emit });
  let gateway: PresenceGateway;

  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new PresenceGateway(prisma as unknown as PrismaService);
    gateway.server = { to: serverTo } as unknown as Server;
    prisma.user.update.mockResolvedValue({});
    prisma.friendship.findMany.mockResolvedValue([
      { requesterId: 42, addresseeId: 7 },
      { requesterId: 9, addresseeId: 42 },
    ]);
  });

  it('resets stale online users at bootstrap', async () => {
    prisma.user.updateMany.mockResolvedValue({ count: 3 });

    await gateway.onApplicationBootstrap();

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { isOnline: true },
      data: { isOnline: false },
    });
  });

  it('joins the user room, sets online and notifies accepted friends on first connection', async () => {
    const { socket, join } = fakeClient('socket-1', 42);

    await gateway.handleConnection(socket);

    expect(join).toHaveBeenCalledWith('user:42');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { isOnline: true, lastSeenAt: expect.any(Date) as Date },
    });
    expect(serverTo).toHaveBeenCalledWith(['user:7', 'user:9']);
    expect(emit).toHaveBeenCalledWith('friend:online', { userId: 42 });
  });

  it('stays silent when a second tab of the same user connects', async () => {
    await gateway.handleConnection(fakeClient('socket-1', 42).socket);
    jest.clearAllMocks();

    await gateway.handleConnection(fakeClient('socket-2', 42).socket);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('sets offline and notifies friends only when the last tab disconnects', async () => {
    const first = fakeClient('socket-1', 42);
    const second = fakeClient('socket-2', 42);
    await gateway.handleConnection(first.socket);
    await gateway.handleConnection(second.socket);
    jest.clearAllMocks();
    prisma.user.update.mockResolvedValue({});
    prisma.friendship.findMany.mockResolvedValue([
      { requesterId: 42, addresseeId: 7 },
    ]);

    await gateway.handleDisconnect(first.socket);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();

    await gateway.handleDisconnect(second.socket);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { isOnline: false, lastSeenAt: expect.any(Date) as Date },
    });
    expect(emit).toHaveBeenCalledWith('friend:offline', { userId: 42 });
  });

  it('emits nothing when the user has no accepted friend', async () => {
    prisma.friendship.findMany.mockResolvedValue([]);

    await gateway.handleConnection(fakeClient('socket-1', 42).socket);

    expect(emit).not.toHaveBeenCalled();
  });

  it('keeps the connection alive when the presence update fails', async () => {
    prisma.user.update.mockRejectedValue(new Error('db down'));
    const { socket, disconnect } = fakeClient('socket-1', 42);

    await expect(gateway.handleConnection(socket)).resolves.toBeUndefined();

    expect(disconnect).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('ignores a disconnect from a socket it never registered', async () => {
    await gateway.handleDisconnect(fakeClient('ghost', 42).socket);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('ignores a disconnect from a socket that was never bound', async () => {
    await gateway.handleDisconnect(fakeClient('ghost', undefined).socket);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('disconnects a socket that was never bound to a user', async () => {
    const { socket, join, disconnect } = fakeClient('socket-1', undefined);

    await gateway.handleConnection(socket);

    expect(disconnect).toHaveBeenCalledWith(true);
    expect(join).not.toHaveBeenCalled();
  });
});
