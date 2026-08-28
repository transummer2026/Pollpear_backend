export function apiKeyCacheKey(keyHash: string): string {
  return `apikey:${keyHash}`;
}
