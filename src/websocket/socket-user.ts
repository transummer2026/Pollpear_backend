import { Socket } from 'socket.io';
import { extractUserId } from 'src/common/extract-user-id';

interface SocketData {
  userId?: number;
}

/**
 * Reads the user id injected by the Rust gateway on the handshake.
 * @returns {number | null} the user id, or null if the socket is not authenticated
 */
export function handshakeUserId(client: Socket): number | null {
  return extractUserId(client.handshake.headers);
}

/**
 * Binds the user to the socket for the rest of its lifetime.
 * @returns {void}
 */
export function bindSocketUser(client: Socket, userId: number): void {
  (client.data as SocketData).userId = userId;
}

/**
 * Reads the user bound to the socket at connection time.
 * @returns {number | null} the user id, or null if the socket is not authenticated
 */
export function socketUserId(client: Socket): number | null {
  const { userId } = client.data as SocketData;
  return typeof userId === 'number' ? userId : null;
}

/**
 * Name of the socket.io room owned by a user, the addressing primitive
 * of every broadcast. Single source of truth: a typo in this string
 * would silently break delivery.
 * @returns {string} the room name for this user
 */
export function userRoom(userId: number): string {
  return `user:${userId}`;
}
