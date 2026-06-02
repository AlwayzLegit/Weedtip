import { describe, expect, it } from 'vitest';
import { dayLabel, formatDistance, formatPrice, formatTime } from '@/lib/format';

describe('formatPrice', () => {
  it('formats cents as USD', () => {
    expect(formatPrice(4500)).toBe('$45.00');
    expect(formatPrice(0)).toBe('$0.00');
    expect(formatPrice(199)).toBe('$1.99');
  });
});

describe('formatDistance', () => {
  it('returns null when distance is null', () => {
    expect(formatDistance(null)).toBeNull();
  });
  it('uses one decimal under 10 miles', () => {
    // ~1609 m per mile
    expect(formatDistance(1609)).toBe('1.0 mi');
    expect(formatDistance(805)).toBe('0.5 mi');
  });
  it('rounds to whole miles at/over 10', () => {
    expect(formatDistance(20000)).toBe('12 mi');
    expect(formatDistance(40000)).toBe('25 mi');
  });
});

describe('formatTime', () => {
  it('converts 24h HH:mm to 12h with period', () => {
    expect(formatTime('09:00')).toBe('9:00 AM');
    expect(formatTime('13:30')).toBe('1:30 PM');
    expect(formatTime('00:00')).toBe('12:00 AM');
    expect(formatTime('12:00')).toBe('12:00 PM');
  });
});

describe('dayLabel', () => {
  it('maps day keys to short labels', () => {
    expect(dayLabel('mon')).toBe('Mon');
    expect(dayLabel('sun')).toBe('Sun');
  });
});
