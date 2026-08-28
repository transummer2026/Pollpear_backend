const ABSOLUTE_URL = /^https?:\/\//i;

export function publicMedia(value: string | null): string | null {
  return value !== null && ABSOLUTE_URL.test(value) ? value : null;
}
