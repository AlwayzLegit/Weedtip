import { dispensaryWriteSchema } from '@weedtip/shared';
import { describe, expect, it } from 'vitest';

const base = {
  name: 'Green Leaf',
  slug: 'green-leaf',
  state: 'NY',
  is_medical: false,
  is_recreational: true,
  is_delivery: false,
  is_pickup: true,
  amenities: [],
};

describe('dispensaryWriteSchema', () => {
  it('accepts a registry listing with no address, ZIP, or coordinates', () => {
    const r = dispensaryWriteSchema.safeParse({ ...base });
    expect(r.success).toBe(true);
  });

  it('still requires a valid 2-letter state', () => {
    expect(dispensaryWriteSchema.safeParse({ ...base, state: '' }).success).toBe(false);
    expect(dispensaryWriteSchema.safeParse({ ...base, state: 'New York' }).success).toBe(false);
  });

  it('validates address, ZIP, and coordinates when they are provided', () => {
    expect(dispensaryWriteSchema.safeParse({ ...base, zip: 'abcde' }).success).toBe(false);
    expect(dispensaryWriteSchema.safeParse({ ...base, address: 'a' }).success).toBe(false);
    expect(
      dispensaryWriteSchema.safeParse({ ...base, location: { lat: 999, lng: 0 } }).success,
    ).toBe(false);
  });

  it('accepts a fully populated listing', () => {
    const r = dispensaryWriteSchema.safeParse({
      ...base,
      address: '123 Main St',
      city: 'New York',
      zip: '10001',
      location: { lat: 40.7, lng: -74 },
    });
    expect(r.success).toBe(true);
  });
});
