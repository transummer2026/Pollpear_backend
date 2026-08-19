import { IncomingHttpHeaders } from 'http';
import { Socket } from 'socket.io';
import {
  bindSocketUser,
  handshakeUserId,
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
});
