import { Socket } from 'socket.io';
import { extractUserId } from 'src/common/extract-user-id';
import { User } from 'src/generated/prisma/client';

interface SocketData {
  userId?: number;
  user?: User;
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
 * of every broadcast. Called a channel to keep the word "room" for the
 * product entity. Single source of truth: a typo in this string would
 * silently break delivery.
 * @returns {string} the channel name for this user
 */
export function userChannel(userId: number): string {
  return `user:${userId}`;
}

export function bindSocketAuthUser(client: Socket, user: User): void {
  (client.data as SocketData).user = user;
}

export function socketAuthUser(client: Socket): User | null {
  return (client.data as SocketData).user ?? null;
}

export function roomChannel(roomId: number): string {
  return `room:${roomId}`;
}
