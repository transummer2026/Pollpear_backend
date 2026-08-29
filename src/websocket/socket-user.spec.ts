import { IncomingHttpHeaders } from 'http';
import { Socket } from 'socket.io';
import type { User } from 'src/generated/prisma/client';
import {
  bindSocketAuthUser,
  bindSocketUser,
  handshakeUserId,
  roomChannel,
  socketAuthUser,
  socketUserId,
  userChannel,
} from './socket-user';

function fakeSocket(headers: IncomingHttpHeaders = {}): Socket {
  return { handshake: { headers }, data: {} } as unknown as Socket;
}

describe('socket-user', () => {
  describe('handshakeUserId', () => {
    it('reads the user id from the handshake headers', () => {
      const client = fakeSocket({ 'x-user-id': '42' });

      expect(handshakeUserId(client)).toBe(42);
    });

    it('yields null when the handshake carries no user header', () => {
      expect(handshakeUserId(fakeSocket())).toBeNull();
    });
  });

  describe('bindSocketUser and socketUserId', () => {
    it('round-trips the user id through the socket data', () => {
      const client = fakeSocket();

      bindSocketUser(client, 7);

      expect(socketUserId(client)).toBe(7);
    });

    it('yields null for a socket that was never bound', () => {
      expect(socketUserId(fakeSocket())).toBeNull();
    });
  });

  describe('userChannel', () => {
    it('names the channel of user 42 exactly user:42', () => {
      expect(userChannel(42)).toBe('user:42');
    });
  });

  describe('roomChannel', () => {
    it('names the channel carrying one product room', () => {
      expect(roomChannel(7)).toBe('room:7');
    });
  });

  describe('auth user binding', () => {
    it('exposes the user the guard read, and null before any guard ran', () => {
      const client = { data: {} } as Socket;

      expect(socketAuthUser(client)).toBeNull();
      bindSocketAuthUser(client, { id: 42 } as User);
      expect(socketAuthUser(client)).toEqual({ id: 42 });
    });
  });
});
