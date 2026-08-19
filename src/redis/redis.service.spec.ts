import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

const SESSION_TTL = 60 * 30;
const PASSWORD_RESET_TTL = 60 * 60;
const EMAIL_VERIFY_TTL = 60 * 60 * 24;
const OAUTH_PENDING_TTL = 60 * 15;

const uuid = '11111111-2222-4333-8444-555555555555';

describe('RedisService', () => {
  const hset = jest.fn();
  const expire = jest.fn();
  const hexpire = jest.fn();
  const get = jest.fn();
  const set = jest.fn();
  const del = jest.fn();
  const redis = { hset, expire, hexpire, get, set, del } as unknown as Redis;
  const service = new RedisService(redis);

  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('sessions', () => {
    it('stores the session hash under session:{id} with a 30 minute expiry', async () => {
      await service.setRedisCache(uuid, 42);

      expect(hset).toHaveBeenCalledWith(`session:${uuid}`, { userId: 42 });
      expect(expire).toHaveBeenCalledWith(`session:${uuid}`, SESSION_TTL);
    });

    it('indexes the session under user_sessions:{userId} and expires that field alone', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-02-03T10:00:00.000Z'));

      await service.setRedisCache(uuid, 42);

      expect(hset).toHaveBeenCalledWith('user_sessions:42', {
        [uuid]: '2026-02-03T10:00:00.000Z',
      });
      expect(hexpire).toHaveBeenCalledWith(
        'user_sessions:42',
        SESSION_TTL,
        'FIELDS',
        1,
        uuid,
      );
    });
  });

  describe('password reset tokens', () => {
    it('writes the token and the user index with a one hour expiry', async () => {
      get.mockResolvedValue(null);

      await service.setPasswordResetToken(uuid, 42);

      expect(set).toHaveBeenCalledWith(
        `password_reset:${uuid}`,
        42,
        'EX',
        PASSWORD_RESET_TTL,
      );
      expect(set).toHaveBeenCalledWith(
        'password_reset_user:42',
        uuid,
        'EX',
        PASSWORD_RESET_TTL,
      );
      expect(del).not.toHaveBeenCalled();
    });

    it('drops the previous token of the user before storing a new one', async () => {
      get.mockResolvedValue('old-token');

      await service.setPasswordResetToken(uuid, 42);

      expect(get).toHaveBeenCalledWith('password_reset_user:42');
      expect(del).toHaveBeenCalledWith('password_reset:old-token');
    });

    it('resolves a stored token to its numeric owner', async () => {
      get.mockResolvedValue('42');

      await expect(service.getPasswordResetToken('tok')).resolves.toBe(42);
      expect(get).toHaveBeenCalledWith('password_reset:tok');
    });

    it('resolves an unknown token to null', async () => {
      get.mockResolvedValue(null);

      await expect(service.getPasswordResetToken('tok')).resolves.toBeNull();
    });

    it('deletes the token and the user index together', async () => {
      await service.deletePasswordResetToken('tok', 42);

      expect(del).toHaveBeenCalledWith(
        'password_reset:tok',
        'password_reset_user:42',
      );
    });
  });

  describe('email verification tokens', () => {
    it('writes the token and the user index with a one day expiry', async () => {
      get.mockResolvedValue(null);

      await service.setEmailVerifyToken(uuid, 42);

      expect(set).toHaveBeenCalledWith(
        `email_verify:${uuid}`,
        42,
        'EX',
        EMAIL_VERIFY_TTL,
      );
      expect(set).toHaveBeenCalledWith(
        'email_verify_user:42',
        uuid,
        'EX',
        EMAIL_VERIFY_TTL,
      );
      expect(del).not.toHaveBeenCalled();
    });

    it('drops the previous token of the user before storing a new one', async () => {
      get.mockResolvedValue('old-token');

      await service.setEmailVerifyToken(uuid, 42);

      expect(get).toHaveBeenCalledWith('email_verify_user:42');
      expect(del).toHaveBeenCalledWith('email_verify:old-token');
    });

    it('resolves a stored token to its numeric owner', async () => {
      get.mockResolvedValue('42');

      await expect(service.getEmailVerifyToken('tok')).resolves.toBe(42);
      expect(get).toHaveBeenCalledWith('email_verify:tok');
    });

    it('deletes the token and the user index together', async () => {
      await service.deleteEmailVerifyToken('tok', 42);

      expect(del).toHaveBeenCalledWith(
        'email_verify:tok',
        'email_verify_user:42',
      );
    });
  });

  describe('oauth pending profiles', () => {
    it('stores the serialized profile under oauth_pending:{token} for 15 minutes', async () => {
      await service.setOauthPendingProfile(uuid, '{"email":"a@b.c"}');

      expect(set).toHaveBeenCalledWith(
        `oauth_pending:${uuid}`,
        '{"email":"a@b.c"}',
        'EX',
        OAUTH_PENDING_TTL,
      );
    });

    it('returns the raw serialized profile', async () => {
      get.mockResolvedValue('{"email":"a@b.c"}');

      await expect(service.getOauthPendingProfile('tok')).resolves.toBe(
        '{"email":"a@b.c"}',
      );
      expect(get).toHaveBeenCalledWith('oauth_pending:tok');
    });

    it('deletes the pending profile by token', async () => {
      await service.deleteOauthPendingProfile('tok');

      expect(del).toHaveBeenCalledWith('oauth_pending:tok');
    });
  });

  describe('api keys', () => {
    it('stores the owner under apikey:{hash} with the given ttl', async () => {
      await service.setApiKey('hash-1', 42, 123);

      expect(set).toHaveBeenCalledWith('apikey:hash-1', 42, 'EX', 123);
    });

    it('deletes a key by its hash', async () => {
      await service.deleteApiKey('hash-1');

      expect(del).toHaveBeenCalledWith('apikey:hash-1');
    });

    it('leaves redis untouched for an empty hash', async () => {
      await service.deleteApiKey('');

      expect(del).not.toHaveBeenCalled();
    });

    it('deletes several keys in a single call', async () => {
      await service.deleteApiKeys(['hash-1', 'hash-2']);

      expect(del).toHaveBeenCalledTimes(1);
      expect(del).toHaveBeenCalledWith('apikey:hash-1', 'apikey:hash-2');
    });

    it('leaves redis untouched for an empty hash list', async () => {
      await service.deleteApiKeys([]);

      expect(del).not.toHaveBeenCalled();
    });
  });
});
