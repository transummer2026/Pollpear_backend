import { websocketOptions } from './websocket.config';

describe('websocketOptions', () => {
  const validConfig = {
    path: '/ws',
    ping_interval: '25000',
    ping_timeout: '20000',
    max_payload: '1000000',
  };

  it('builds the server options from a valid Vault config', () => {
    const options = websocketOptions(validConfig);

    expect(options).toMatchObject({
      path: '/ws',
      transports: ['websocket'],
      serveClient: false,
      pingInterval: 25000,
      pingTimeout: 20000,
      maxHttpBufferSize: 1000000,
    });
  });

  it('throws a clear boot error on a non-numeric value', () => {
    expect(() =>
      websocketOptions({ ...validConfig, ping_interval: '25s' }),
    ).toThrow(/Invalid secret\/pollpear\/ws config: ping_interval/);
  });

  it('throws a clear boot error on a path missing its leading slash', () => {
    expect(() => websocketOptions({ ...validConfig, path: 'ws' })).toThrow(
      /Invalid secret\/pollpear\/ws config: path/,
    );
  });

  it('throws a clear boot error when a key is missing from the seed', () => {
    const { max_payload: _dropped, ...incomplete } = validConfig;
    void _dropped;

    expect(() => websocketOptions(incomplete as typeof validConfig)).toThrow(
      /Invalid secret\/pollpear\/ws config: max_payload/,
    );
  });

  it('rejects a zero heartbeat interval', () => {
    expect(() =>
      websocketOptions({ ...validConfig, ping_interval: '0' }),
    ).toThrow(/Invalid secret\/pollpear\/ws config: ping_interval/);
  });

  it('keeps the base options it is given', () => {
    const options = websocketOptions(validConfig, { connectTimeout: 123 });

    expect(options.connectTimeout).toBe(123);
  });
});
