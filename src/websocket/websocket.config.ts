import { ServerOptions } from 'socket.io';
import { z } from 'zod';
import { WsConfig } from 'src/vault/vault.service';

/**
 * Builds the socket.io ServerOptions from the Vault secret
 * secret/pollpear/ws (seeded by Pollpear_cyber). Values arrive as
 * strings and are validated here: a broken seed must be a clear boot
 * error, not a NaN silently handed to socket.io or a path falling back
 * to the socket.io default (which 404s every client).
 * No cors block: the transport is websocket-only and CORS only applies
 * to the polling transport; browser-facing CORS is the Rust gateway's
 * job anyway.
 */
const WsConfigSchema = z.object({
  path: z.string().startsWith('/'),
  ping_interval: z.coerce.number().int().positive(),
  ping_timeout: z.coerce.number().int().positive(),
  max_payload: z.coerce.number().int().positive(),
});

export function websocketOptions(
  ws: WsConfig,
  base?: Partial<ServerOptions>,
): Partial<ServerOptions> {
  const parsed = WsConfigSchema.safeParse(ws);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
    throw new Error(`Invalid secret/pollpear/ws config: ${issues}`);
  }
  return {
    ...base,
    path: parsed.data.path,
    transports: ['websocket'],
    serveClient: false,
    pingInterval: parsed.data.ping_interval,
    pingTimeout: parsed.data.ping_timeout,
    maxHttpBufferSize: parsed.data.max_payload,
  };
}
