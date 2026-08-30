import { Logger, NotFoundException } from '@nestjs/common';
import { ForbiddenError } from '@casl/ability';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { WebsocketEmitter } from 'src/websocket/websocket.emitter';
import { MessagesGateway } from './messages.gateway';
import { MessagesService } from './messages.service';
import type { User } from 'src/generated/prisma/client';

const viewer = { id: 42, role: 'user' } as User;

function fakeClient() {
  const join = jest.fn();
  const leave = jest.fn();
  const socket = { id: 's1', join, leave } as unknown as Socket;
  return { socket, join, leave };
}

describe('MessagesGateway', () => {
  const assertCanJoin = jest.fn();
  const create = jest.fn();
  const messages = { assertCanJoin, create } as unknown as MessagesService;
  const toRoom = jest.fn();
  const emitter = { toRoom } as unknown as WebsocketEmitter;
  let gateway: MessagesGateway;
  let client: Socket;
  let join: jest.Mock;
  let leave: jest.Mock;

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new MessagesGateway(messages, emitter);
    ({ socket: client, join, leave } = fakeClient());
  });

  describe('room:join', () => {
    it('joins the room channel once the read policy allows it', async () => {
      assertCanJoin.mockResolvedValue(undefined);

      await expect(
        gateway.join(client, viewer, { roomId: 7 }),
      ).resolves.toEqual({ roomId: 7 });
      expect(assertCanJoin).toHaveBeenCalledWith(viewer, 7);
      expect(join).toHaveBeenCalledWith('room:7');
    });

    it('refuses a room the viewer may not read, without joining', async () => {
      assertCanJoin.mockRejectedValue(new ForbiddenError({} as never));

      await expect(gateway.join(client, viewer, { roomId: 7 })).rejects.toThrow(
        WsException,
      );
      expect(join).not.toHaveBeenCalled();
    });

    it('reports a missing room as a refusal, not an internal error', async () => {
      assertCanJoin.mockRejectedValue(new NotFoundException('Room not found'));

      await expect(gateway.join(client, viewer, { roomId: 7 })).rejects.toThrow(
        'Room not found',
      );
    });
  });

  describe('room:leave', () => {
    it('leaves the room channel', async () => {
      await expect(gateway.leave(client, { roomId: 7 })).resolves.toEqual({
        roomId: 7,
      });
      expect(leave).toHaveBeenCalledWith('room:7');
    });
  });

  describe('message:send', () => {
    it('persists then broadcasts to the room, and acks the sender', async () => {
      const message = { id: 1, roomId: 7, content: 'hi' };
      create.mockResolvedValue(message);

      await expect(
        gateway.send(client, viewer, { roomId: 7, content: 'hi' }),
      ).resolves.toBe(message);
      expect(create).toHaveBeenCalledWith(viewer, { roomId: 7, content: 'hi' });
      expect(toRoom).toHaveBeenCalledWith(7, 'message:new', message, 's1');
    });

    it('does not broadcast when the viewer may not post', async () => {
      create.mockRejectedValue(new ForbiddenError({} as never));

      await expect(
        gateway.send(client, viewer, { roomId: 7, content: 'hi' }),
      ).rejects.toThrow(WsException);
      expect(toRoom).not.toHaveBeenCalled();
    });
  });
});
