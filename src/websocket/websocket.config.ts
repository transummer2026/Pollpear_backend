import { ServerOptions } from 'socket.io';

export function websocketOptions(
  base?: Partial<ServerOptions>,
): Partial<ServerOptions> {
  return Object.assign({}, base, {
    path: process.env.WS_PATH ?? console.log('WS_PATH not set in .env'),
    transports: ['websocket'],
    serveClient: false,
    cors: {
      origin:
        process.env.FRONTEND_URL ?? console.log('FRONTEND_URL not set in .env'),
      credentials: true,
    },
    pingInterval: Number(process.env.WS_PING_INTERVAL ?? 25000),
    pingTimeout: Number(process.env.WS_PING_TIMEOUT ?? 20000),
    maxHttpBufferSize: Number(process.env.WS_MAX_PAYLOAD ?? 1_000_000),
  });
}
