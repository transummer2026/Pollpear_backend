import { ServerOptions } from 'socket.io';

export function websocketOptions(
  base?: Partial<ServerOptions>,
): Partial<ServerOptions> {
  return Object.assign({}, base, {
    path: process.env.WS_PATH ?? '/ws',
    transports: ['websocket'],
    serveClient: false,
    cors: {
      origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
      credentials: true,
    },
    pingInterval: Number(process.env.WS_PING_INTERVAL ?? 25000),
    pingTimeout: Number(process.env.WS_PING_TIMEOUT ?? 20000),
    maxHttpBufferSize: Number(process.env.WS_MAX_PAYLOAD ?? 1_000_000),
  });
}
