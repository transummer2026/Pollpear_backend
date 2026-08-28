import { publicMedia } from './media';
import { ApiMeAvatarSchema } from './schemas/api-me.schema';
import { StorageService } from 'src/storage/storage.service';
import { VaultService } from 'src/vault/vault.service';

const DEFAULT_AVATAR = '/uploads/avatars/default.svg';
const DEFAULT_BANNER = '/uploads/banners/default.svg';

/**
 * Two reasons the built-in placeholders answer null rather than a path.
 * A stored default is worth nothing to a caller: it has no more meaning
 * than the absence it stands for, and only the caller knows what to draw
 * instead. And a path is a piece of our storage layout, which the public
 * api has no business publishing.
 */
describe('publicMedia hides what is ours', () => {
  it.each([DEFAULT_AVATAR, DEFAULT_BANNER])(
    'answers null for the built-in placeholder %s',
    (placeholder) => {
      expect(publicMedia(placeholder)).toBeNull();
    },
  );

  it.each([
    ['a relative path', '/uploads/avatars/12.webp'],
    ['a bare key', 'avatars/12.webp'],
    ['a protocol relative host', '//cdn.pollpear.com/a.webp'],
    ['an empty value', ''],
  ])('answers null for %s', (_case, value) => {
    expect(publicMedia(value)).toBeNull();
  });

  it('answers null when there is nothing stored at all', () => {
    expect(publicMedia(null)).toBeNull();
  });

  it.each([
    'https://cdn.pollpear.com/uploads/avatars/12.webp?v=2',
    'http://localhost:8080/uploads/avatars/12.webp',
  ])('hands back %s untouched, it is already public', (url) => {
    expect(publicMedia(url)).toBe(url);
  });

  it('never lets a storage path through, whatever it looks like', () => {
    const leaked = [DEFAULT_AVATAR, '/uploads/avatars/12.webp', 'avatars/1']
      .map(publicMedia)
      .filter((value) => value !== null);

    expect(leaked).toEqual([]);
  });
});

/**
 * The upload answer is deliberately not nullable: a stored image exists by
 * the time it is built, so null there would hide a broken gateway url
 * rather than describe a caller that has no avatar.
 */
describe('the upload answer stays a real url', () => {
  function publicUrlOf(gatewayUrl: string, userId: number) {
    return `${gatewayUrl}/uploads/avatars/${userId}.webp?v=${Date.now()}`;
  }

  it('accepts what the storage layer builds from a configured gateway', () => {
    const url = publicUrlOf('https://pollpear.com', 12);

    expect(publicMedia(url)).toBe(url);
    expect(ApiMeAvatarSchema.safeParse({ avatarUrl: url }).success).toBe(true);
  });

  it('refuses to answer once the gateway url goes missing', () => {
    const url = publicUrlOf('', 12);

    expect(publicMedia(url)).toBeNull();
    expect(ApiMeAvatarSchema.safeParse({ avatarUrl: url }).success).toBe(false);
  });

  /**
   * A scheme is case insensitive per RFC 3986. Read and write used to
   * disagree on one written in caps - the schema accepted it, the read
   * path blanked it out - so both now follow the rfc.
   */
  it.each(['HTTPS://pollpear.com', 'HtTp://pollpear.com'])(
    'agrees with the schema on the scheme case of %s',
    (gateway) => {
      const url = publicUrlOf(gateway, 12);

      expect(publicMedia(url)).toBe(url);
      expect(ApiMeAvatarSchema.safeParse({ avatarUrl: url }).success).toBe(
        true,
      );
    },
  );
});

function publicUrlFor(gatewayUrl: string): string {
  const storage = new StorageService({
    s3: {
      bucket: 'b',
      endpoint: 'e',
      region: 'r',
      access_key: 'k',
      secret_key: 's',
    },
    app: { gateway_url: gatewayUrl },
  } as unknown as VaultService);

  return storage.publicUrl('avatars/12.webp');
}

function expectUsableByAnApiClient(gatewayUrl: string) {
  const url = publicUrlFor(gatewayUrl);

  expect(publicMedia(url)).toBe(url);
  expect(ApiMeAvatarSchema.safeParse({ avatarUrl: url }).success).toBe(true);
}

/**
 * A media url only means something to an api client if it carries its own
 * host: unlike a browser, a third party has no page origin to resolve a
 * path against. These walk the real StorageService with every GATEWAY_URL
 * the project ships, and assert the answer is one a client can fetch.
 */
describe.each([
  ['dev', 'http://localhost:8080/api'],
  ['a staging host', 'https://dev.pollpear.com/api'],
  ['a prod host', 'https://pollpear.com/api'],
])('a media url built for %s', (_name, gatewayUrl) => {
  it('is usable by an api client', () => {
    expectUsableByAnApiClient(gatewayUrl);
  });
});

/**
 * Known gap, kept executable rather than written down. .env.example sets
 * GATEWAY_URL=/api for staging and prod, and seed.sh falls back to it when
 * the variable is unset - correct for the browser, which resolves it
 * against the page, and unusable for an api client. These are `failing`,
 * so they pass while the gap is open and break the day it closes, which is
 * the day they should become plain assertions.
 */
describe.each([
  ['the staging and prod value', '/api'],
  ['the seed fallback', '/api'],
])('a media url built from %s', (_name, gatewayUrl) => {
  it.failing('cannot be used by an api client', () => {
    expectUsableByAnApiClient(gatewayUrl);
  });
});
