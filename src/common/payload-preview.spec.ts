import { payloadPreview } from './payload-preview';

describe('payloadPreview', () => {
  it('returns a short payload untouched', () => {
    expect(payloadPreview({ a: 1 })).toBe('{"a":1}');
  });

  it('truncates an oversized payload and reports its full length', () => {
    const preview = payloadPreview('x'.repeat(300));

    expect(preview).toHaveLength(200 + '... (302 chars)'.length);
    expect(preview.endsWith('... (302 chars)')).toBe(true);
  });

  it('respects a custom truncation limit', () => {
    expect(payloadPreview('x'.repeat(300), 10)).toBe(
      `${'"'}${'x'.repeat(9)}... (302 chars)`,
    );
  });

  it('serializes values JSON.stringify cannot represent', () => {
    expect(payloadPreview(undefined)).toBe('undefined');
  });

  it('falls back on circular structures instead of throwing', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;

    expect(() => payloadPreview(circular)).not.toThrow();
    expect(payloadPreview(circular)).toBe('[object Object]');
  });
});
