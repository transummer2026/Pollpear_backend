import { Logger } from '@nestjs/common';
import {
  expiryFromTtl,
  fingerprint,
  generateApiKey,
  hashApiKey,
  remainingSeconds,
} from './api-key.util';

describe('api-key util', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  describe('fingerprint', () => {
    it('keeps the first 12 characters and masks the rest', () => {
      const keyHash = 'abcdef123456REST0FTHEHASH';

      expect(fingerprint(keyHash)).toBe(`abcdef123456${'*'.repeat(13)}`);
    });

    it.each([
      ['abcdefghijkl', 'abcdefghijkl'],
      ['short', 'short'],
      ['', ''],
    ])(
      'leaves %p untouched when it has 12 characters or fewer',
      (hash, expected) => {
        expect(fingerprint(hash)).toBe(expected);
      },
    );
  });

  describe('hashApiKey', () => {
    it('produces the hex sha256 of the key', () => {
      expect(hashApiKey('abc')).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    });

    it('renders 64 hex characters for any input', () => {
      expect(hashApiKey('another key')).toMatch(/^[0-9a-f]{64}$/);
    });

    it('hashes the same input to the same value', () => {
      expect(hashApiKey('same input')).toBe(hashApiKey('same input'));
    });
  });

  describe('generateApiKey', () => {
    it('prefixes every key with pp_live_', () => {
      const { key } = generateApiKey();

      expect(key.startsWith('pp_live_')).toBe(true);
    });

    it('returns the hash of the key it just generated', () => {
      const { key, keyHash } = generateApiKey();

      expect(keyHash).toBe(hashApiKey(key));
    });

    it('generates a different key on every call', () => {
      const first = generateApiKey();
      const second = generateApiKey();

      expect(second.key).not.toBe(first.key);
      expect(second.keyHash).not.toBe(first.keyHash);
    });
  });

  describe('expiryFromTtl and remainingSeconds', () => {
    const now = new Date('2026-08-17T12:00:00Z');

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(now);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('places the expiry ttl seconds into the future', () => {
      expect(expiryFromTtl(60)).toEqual(new Date(now.getTime() + 60_000));
    });

    it('round-trips a ttl through expiryFromTtl and remainingSeconds', () => {
      expect(remainingSeconds(expiryFromTtl(3600))).toBe(3600);
    });

    it('rounds a partial second down', () => {
      expect(remainingSeconds(new Date(now.getTime() + 1500))).toBe(1);
    });

    it('turns negative once the expiry date is past', () => {
      expect(remainingSeconds(new Date(now.getTime() - 500))).toBe(-1);
    });
  });
});
