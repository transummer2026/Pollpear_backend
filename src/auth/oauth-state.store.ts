import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { type Request } from 'express';
import {
  type Metadata,
  type StateStore,
  type StateStoreStoreCallback,
  type StateStoreVerifyCallback,
} from 'passport-oauth2';

export const OAUTH_STATE_COOKIE = 'oauth_state';

@Injectable()
export class OauthStateStore implements StateStore {
  store(req: Request, callback: StateStoreStoreCallback): void;
  store(req: Request, meta: Metadata, callback: StateStoreStoreCallback): void;
  store(
    req: Request,
    metaOrCallback: Metadata | StateStoreStoreCallback,
    maybeCallback?: StateStoreStoreCallback,
  ): void {
    const cb =
      typeof metaOrCallback === 'function' ? metaOrCallback : maybeCallback;
    const state = randomUUID();
    req.res?.cookie(OAUTH_STATE_COOKIE, state, {
      // TODO: add secure: true for PROD
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
    });
    cb?.(null, state);
  }

  verify(req: Request, state: string, callback: StateStoreVerifyCallback): void;
  verify(
    req: Request,
    state: string,
    meta: Metadata,
    callback: StateStoreVerifyCallback,
  ): void;
  verify(
    req: Request,
    state: string,
    metaOrCallback: Metadata | StateStoreVerifyCallback,
    maybeCallback?: StateStoreVerifyCallback,
  ): void {
    const cb =
      typeof metaOrCallback === 'function' ? metaOrCallback : maybeCallback;
    const cookies = req.cookies as Record<string, string> | undefined;
    const expected = cookies?.[OAUTH_STATE_COOKIE];
    req.res?.clearCookie(OAUTH_STATE_COOKIE);
    cb?.(null, !!expected && expected === state, state);
  }
}
