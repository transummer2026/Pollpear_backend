// src/api/v1/common/media.ts
const ABSOLUTE_URL = /^https?:\/\//;

export function publicMedia(value: string | null): string | null {
  return value !== null && ABSOLUTE_URL.test(value) ? value : null;
}
