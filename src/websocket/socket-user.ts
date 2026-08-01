import { Socket } from 'socket.io';

interface SocketData {
  userId?: number;
}

/**
 * lis le user id injecté par la gateway Rust lors du handshake
 * @returns {number | null} l id de l utilisateur ou null si socket non authentifie
 */
export function handshakeUserId(client: Socket): number | null {
  const raw = client.handshake.headers['x-user-id'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const userId = Number(value);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

/**
 * stocke l'utilisateur le socket pour la gestion d events
 * @returns {void}
 */
export function bindSocketUser(client: Socket, userId: number): void {
  (client.data as SocketData).userId = userId;
}

/**
 * lis l user lier au socker a la connection
 * @returns {number | null} l id de l utilisateur ou null si socket non authentifie
 */
export function socketUserId(client: Socket): number | null {
  const { userId } = client.data as SocketData;
  return typeof userId === 'number' ? userId : null;
}
