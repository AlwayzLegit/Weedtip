import { describe, expect, it } from 'vitest';
import { cn, slugify } from '@/lib/utils';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Green Leaf NYC')).toBe('green-leaf-nyc');
  });
  it('strips punctuation and collapses separators', () => {
    expect(slugify('  OG Kush!! 3.5g  ')).toBe('og-kush-3-5g');
  });
  it('trims leading/trailing hyphens', () => {
    expect(slugify('--Hello--')).toBe('hello');
  });
  it('caps length at 80 chars', () => {
    expect(slugify('a'.repeat(200)).length).toBe(80);
  });
});

describe('cn', () => {
  it('merges and dedupes conflicting tailwind classes (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
  it('drops falsy values', () => {
    expect(cn('text-sm', false, undefined, 'font-bold')).toBe('text-sm font-bold');
  });
});
