import { extractUserId } from './extract-user-id';

describe('extractUserId', () => {
  it('parses a valid positive integer id', () => {
    expect(extractUserId({ 'x-user-id': '42' })).toBe(42);
  });

  it('takes the first value when the header is an array', () => {
    expect(extractUserId({ 'x-user-id': ['7', '8'] })).toBe(7);
  });

  it('returns null when the header is absent', () => {
    expect(extractUserId({})).toBeNull();
  });

  it.each(['', '0', '-3', 'abc', '1.5'])(
    'returns null for invalid value %p',
    (value) => {
      expect(extractUserId({ 'x-user-id': value })).toBeNull();
    },
  );
});
