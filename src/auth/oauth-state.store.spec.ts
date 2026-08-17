import { type Request } from 'express';
import { type Metadata } from 'passport-oauth2';
import { OAUTH_STATE_COOKIE, OauthStateStore } from './oauth-state.store';

function makeReq(cookies?: Record<string, string>) {
  const cookie = jest.fn();
  const clearCookie = jest.fn();
  const req = { cookies, res: { cookie, clearCookie } } as unknown as Request;
  return { req, cookie, clearCookie };
}

describe('OauthStateStore', () => {
  const store = new OauthStateStore();

  beforeEach(() => jest.clearAllMocks());

  describe('store', () => {
    it('puts a fresh state in a short-lived cookie and hands it to the callback', () => {
      const { req, cookie } = makeReq();
      const callback = jest.fn();

      store.store(req, callback);

      const [name, state, options] = cookie.mock.calls[0] as [
        string,
        string,
        Record<string, unknown>,
      ];
      expect(name).toBe(OAUTH_STATE_COOKIE);
      expect(options).toMatchObject({
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
      });
      expect(callback).toHaveBeenCalledWith(null, state);
    });

    it('behaves the same through the overload carrying passport metadata', () => {
      const { req, cookie } = makeReq();
      const callback = jest.fn();

      store.store(req, {} as Metadata, callback);

      const [name, state] = cookie.mock.calls[0] as [string, string];
      expect(name).toBe(OAUTH_STATE_COOKIE);
      expect(callback).toHaveBeenCalledWith(null, state);
    });

    it('generates a different state on every call', () => {
      const { req } = makeReq();
      const first = jest.fn();
      const second = jest.fn();

      store.store(req, first);
      store.store(req, second);

      const [, firstState] = first.mock.calls[0] as [null, string];
      const [, secondState] = second.mock.calls[0] as [null, string];
      expect(firstState).not.toBe(secondState);
    });
  });

  describe('verify', () => {
    it('accepts a state matching the cookie and clears it', () => {
      const { req, clearCookie } = makeReq({ [OAUTH_STATE_COOKIE]: 'state-1' });
      const callback = jest.fn();

      store.verify(req, 'state-1', callback);

      expect(callback).toHaveBeenCalledWith(null, true, 'state-1');
      expect(clearCookie).toHaveBeenCalledWith(OAUTH_STATE_COOKIE);
    });

    it('rejects a state that differs from the cookie, still clearing it', () => {
      const { req, clearCookie } = makeReq({ [OAUTH_STATE_COOKIE]: 'state-1' });
      const callback = jest.fn();

      store.verify(req, 'forged-state', callback);

      expect(callback).toHaveBeenCalledWith(null, false, 'forged-state');
      expect(clearCookie).toHaveBeenCalledWith(OAUTH_STATE_COOKIE);
    });

    it('rejects a request without any state cookie, still clearing it', () => {
      const { req, clearCookie } = makeReq();
      const callback = jest.fn();

      store.verify(req, 'state-1', callback);

      expect(callback).toHaveBeenCalledWith(null, false, 'state-1');
      expect(clearCookie).toHaveBeenCalledWith(OAUTH_STATE_COOKIE);
    });

    it('behaves the same through the overload carrying passport metadata', () => {
      const { req, clearCookie } = makeReq({ [OAUTH_STATE_COOKIE]: 'state-1' });
      const callback = jest.fn();

      store.verify(req, 'state-1', {} as Metadata, callback);

      expect(callback).toHaveBeenCalledWith(null, true, 'state-1');
      expect(clearCookie).toHaveBeenCalledWith(OAUTH_STATE_COOKIE);
    });
  });
});
