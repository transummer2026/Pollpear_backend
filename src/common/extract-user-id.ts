import { IncomingHttpHeaders } from 'http';

/**
 * Parses the x-user-id header injected by the Rust gateway into a
 * positive integer user id. Single source of truth shared by the HTTP
 * AuthGuard and the websocket handshake.
 * @param headers incoming request or handshake headers
 * @returns {number | null} the user id, or null if absent or invalid
 */
export function extractUserId(headers: IncomingHttpHeaders): number | null {
  const raw = headers['x-user-id'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const userId = Number(value);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}
