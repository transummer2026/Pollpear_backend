import { Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { ApiKeyService } from './api-key.service';
import { hashApiKey } from './api-key.util';

const NOW = new Date('2026-02-03T10:00:00.000Z');
const YEAR_SECONDS = 365 * 24 * 60 * 60;
const EXPECTED_EXPIRY = new Date(NOW.getTime() + YEAR_SECONDS * 1000);

function activeWhere(userId?: number) {
  return {
    ...(userId === undefined ? {} : { ownerId: userId }),
    revoked: false,
    expiredAt: { gt: NOW },
  };
}

describe('ApiKeyService', () => {
  const findFirst = jest.fn();
  const findMany = jest.fn();
  const create = jest.fn();
  const update = jest.fn();
  const updateMany = jest.fn();
  const $transaction = jest.fn((operations: unknown[]) =>
    Promise.all(operations),
  );
  const prisma = {
    $transaction,
    apiKey: { findFirst, findMany, create, update, updateMany },
  } as unknown as PrismaService;

  const setApiKey = jest.fn();
  const deleteApiKey = jest.fn();
  const deleteApiKeys = jest.fn();
  const redis = {
    setApiKey,
    deleteApiKey,
    deleteApiKeys,
  } as unknown as RedisService;

  const service = new ApiKeyService(prisma, redis);

  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(NOW);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('create', () => {
    it('revokes the previous key in redis and overwrites it in the same transaction', async () => {
      findFirst.mockResolvedValue({ id: 1, keyHash: 'old-hash' });
      const revocation = { count: 1 };
      updateMany.mockReturnValue(revocation);
      const row = {
        id: 2,
        appName: 'cli',
        expiredAt: EXPECTED_EXPIRY,
        createdAt: NOW,
      };
      create.mockReturnValue(row);

      const result = await service.create(7, 'cli');

      expect(updateMany).toHaveBeenCalledWith({
        where: activeWhere(7),
        data: { revoked: true },
      });
      expect($transaction).toHaveBeenCalledWith([revocation, row]);
      expect(deleteApiKey).toHaveBeenCalledWith('old-hash');
      expect(setApiKey).toHaveBeenCalledWith(
        hashApiKey(result.key),
        7,
        YEAR_SECONDS,
      );
      expect(result).toEqual({ ...row, key: result.key });
      expect(result.key).toMatch(/^pp_live_/);
    });

    it('persists only the hash of the key it returns in clear', async () => {
      findFirst.mockResolvedValue(null);
      create.mockReturnValue({
        id: 2,
        appName: 'cli',
        expiredAt: EXPECTED_EXPIRY,
        createdAt: NOW,
      });

      const result = await service.create(7, 'cli');

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            keyHash: hashApiKey(result.key),
            ownerId: 7,
            expiredAt: EXPECTED_EXPIRY,
            appName: 'cli',
          },
        }),
      );
    });

    it('skips the redis purge when there is no previous key and falls back to the default name', async () => {
      findFirst.mockResolvedValue(null);
      create.mockReturnValue({
        id: 3,
        appName: 'default',
        expiredAt: EXPECTED_EXPIRY,
        createdAt: NOW,
      });

      const result = await service.create(7);

      expect(deleteApiKey).not.toHaveBeenCalled();
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            keyHash: hashApiKey(result.key),
            ownerId: 7,
            expiredAt: EXPECTED_EXPIRY,
            appName: 'default',
          },
        }),
      );
      expect(setApiKey).toHaveBeenCalledWith(
        hashApiKey(result.key),
        7,
        YEAR_SECONDS,
      );
    });
  });

  describe('update', () => {
    it('renames the active key', async () => {
      findFirst.mockResolvedValue({ id: 3, keyHash: 'hash-3' });
      const renamed = {
        id: 3,
        appName: 'renamed',
        expiredAt: EXPECTED_EXPIRY,
        createdAt: NOW,
      };
      update.mockResolvedValue(renamed);

      await expect(service.update(7, 'renamed')).resolves.toEqual(renamed);
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 3 },
          data: { appName: 'renamed' },
        }),
      );
    });

    it('rejects when there is no active key', async () => {
      findFirst.mockResolvedValue(null);

      await expect(service.update(7, 'renamed')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.update(7, 'renamed')).rejects.toThrow(
        'No active api key',
      );
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    it('marks the key revoked in postgres and drops it from redis', async () => {
      findFirst.mockResolvedValue({ id: 4, keyHash: 'hash-4' });

      await service.revoke(7);

      expect(update).toHaveBeenCalledWith({
        where: { id: 4 },
        data: { revoked: true },
      });
      expect(deleteApiKey).toHaveBeenCalledWith('hash-4');
    });

    it('stays silent when there is nothing to revoke', async () => {
      findFirst.mockResolvedValue(null);

      await expect(service.revoke(7)).resolves.toBeUndefined();
      expect(update).not.toHaveBeenCalled();
      expect(deleteApiKey).not.toHaveBeenCalled();
    });
  });

  describe('revokeAll', () => {
    it('revokes every active key and purges redis in a single call', async () => {
      findMany.mockResolvedValue([{ keyHash: 'a' }, { keyHash: 'b' }]);

      await service.revokeAll(7);

      expect(updateMany).toHaveBeenCalledWith({
        where: activeWhere(7),
        data: { revoked: true },
      });
      expect(deleteApiKeys).toHaveBeenCalledTimes(1);
      expect(deleteApiKeys).toHaveBeenCalledWith(['a', 'b']);
    });

    it('does nothing when the user has no active key', async () => {
      findMany.mockResolvedValue([]);

      await service.revokeAll(7);

      expect(updateMany).not.toHaveBeenCalled();
      expect(deleteApiKeys).not.toHaveBeenCalled();
    });
  });

  describe('restoreAll', () => {
    it('queries active keys across every owner', async () => {
      findMany.mockResolvedValue([]);

      await service.restoreAll();

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: activeWhere() }),
      );
    });

    it('restores each key with its remaining ttl, never a full lifetime', async () => {
      findMany.mockResolvedValue([
        {
          keyHash: 'k1',
          ownerId: 2,
          expiredAt: new Date(NOW.getTime() + 90_000),
        },
        {
          keyHash: 'k2',
          ownerId: 3,
          expiredAt: new Date(NOW.getTime() + 500_500),
        },
      ]);

      await expect(service.restoreAll()).resolves.toBe(2);

      expect(setApiKey).toHaveBeenCalledWith('k1', 2, 90);
      expect(setApiKey).toHaveBeenCalledWith('k2', 3, 500);
    });

    it('skips keys already expired or expiring this very second', async () => {
      findMany.mockResolvedValue([
        {
          keyHash: 'gone',
          ownerId: 1,
          expiredAt: new Date(NOW.getTime() - 1000),
        },
        {
          keyHash: 'edge',
          ownerId: 2,
          expiredAt: new Date(NOW.getTime() + 999),
        },
        {
          keyHash: 'kept',
          ownerId: 3,
          expiredAt: new Date(NOW.getTime() + 60_000),
        },
      ]);

      await expect(service.restoreAll()).resolves.toBe(1);

      expect(setApiKey).toHaveBeenCalledTimes(1);
      expect(setApiKey).toHaveBeenCalledWith('kept', 3, 60);
    });
  });
});
