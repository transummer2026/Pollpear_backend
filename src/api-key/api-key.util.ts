import { Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

const KEY_PREFIX = 'pp_live_';
const KEY_BYTES = 32;
const FINGERPRINT_LENGTH = 12;
const HASH_TYPE = 'sha256';
const BUFFER_ENCODING = 'base64url';
const INPUT_ENCODING = 'utf8';
const BINARY_ENCODING = 'hex';
const MASK_CHAR = '*';
const MILLISECONDS_PER_SECOND = 1000;

const logger = new Logger('ApiKey');

/**
 * return the shortest fingerprint of a key hash, which is enough to correlate log lines
 * @param keyHash full hash of an API key
 * @returns {string} the leading characters, enough to correlate log lines
 */
export function fingerprint(keyHash: string): string {
  const masked = Math.max(0, keyHash.length - FINGERPRINT_LENGTH);
  return keyHash.slice(0, FINGERPRINT_LENGTH) + MASK_CHAR.repeat(masked);
}

/**
 * Hashes an API key using HASH_TYPE. The hash is stored in Postgres and Redis, while the plaintext key is never persisted.
 * @returns {string} hash of the API key
 */
export function hashApiKey(key: string): string {
  const keyHash = createHash(HASH_TYPE)
    .update(key, INPUT_ENCODING)
    .digest(BINARY_ENCODING);
  logger.debug(`hashed api key ${fingerprint(keyHash)}`);
  return keyHash;
}

/**
 * Generates a new API key and its hash. The plaintext key is never persisted,
 * only the hash is stored in Postgres and Redis.
 * @returns {{ key: string; keyHash: string }} plaintext key and its hash
 */
export function generateApiKey(): { key: string; keyHash: string } {
  const key = `${KEY_PREFIX}${randomBytes(KEY_BYTES).toString(BUFFER_ENCODING)}`;
  const keyHash = hashApiKey(key);
  logger.log(`generated api key ${fingerprint(keyHash)}`);
  return { key, keyHash };
}

/**
 * Turns a lifetime into the date Postgres stores. Reciprocal of
 * remainingSeconds: both live here so the two directions cannot drift.
 * @param ttl lifetime in seconds
 * @returns {Date} when the key stops being valid
 */
export function expiryFromTtl(ttl: number): Date {
  return new Date(Date.now() + ttl * MILLISECONDS_PER_SECOND);
}

/**
 * Seconds left before a key expires, used as the redis ttl. Restoring a key
 * has to reuse this and never a full lifetime, which would push the expiry
 * further away on every restart until keys never expire at all.
 * @param expiresAt when the key stops being valid
 * @returns {number} seconds left, negative once expired
 */
export function remainingSeconds(expiresAt: Date): number {
  const remaining = expiresAt.getTime() - Date.now();
  return Math.floor(remaining / MILLISECONDS_PER_SECOND);
}
