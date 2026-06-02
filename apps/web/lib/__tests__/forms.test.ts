import { describe, expect, it } from 'vitest';
import { bool, numOpt, str } from '@/lib/forms';

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe('str', () => {
  it('trims and returns the value', () => {
    expect(str(fd({ name: '  hello  ' }), 'name')).toBe('hello');
  });
  it('returns undefined for empty/whitespace/missing', () => {
    expect(str(fd({ name: '   ' }), 'name')).toBeUndefined();
    expect(str(fd({}), 'name')).toBeUndefined();
  });
});

describe('bool', () => {
  it('is true only for "on" or "true"', () => {
    expect(bool(fd({ x: 'on' }), 'x')).toBe(true);
    expect(bool(fd({ x: 'true' }), 'x')).toBe(true);
    expect(bool(fd({ x: 'false' }), 'x')).toBe(false);
    expect(bool(fd({}), 'x')).toBe(false);
  });
});

describe('numOpt', () => {
  it('parses finite numbers', () => {
    expect(numOpt(fd({ n: '42' }), 'n')).toBe(42);
    expect(numOpt(fd({ n: '3.5' }), 'n')).toBe(3.5);
  });
  it('returns undefined for missing or non-numeric', () => {
    expect(numOpt(fd({}), 'n')).toBeUndefined();
    expect(numOpt(fd({ n: 'abc' }), 'n')).toBeUndefined();
  });
});
