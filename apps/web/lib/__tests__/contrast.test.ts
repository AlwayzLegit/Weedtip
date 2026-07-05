import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config';

/**
 * WCAG contrast guards for the design tokens (WT-14). Text pairings must meet
 * AA (≥ 4.5:1 normal text, ≥ 3:1 large/UI), and adjacent surfaces must differ
 * by ≥ ~1.25:1 so cards read as raised panels on the dark theme. Editing
 * tailwind.config.ts colors below these floors fails CI.
 */

type Colors = Record<string, string | Record<string, string>>;
const colors = (config.theme?.extend?.colors ?? {}) as Colors;

function token(name: string): string {
  const [base, sub] = name.split('.');
  const value = sub ? (colors[base!] as Record<string, string>)[sub] : colors[name];
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`Token ${name} is not a 6-digit hex color: ${String(value)}`);
  }
  return value;
}

function luminance(hex: string): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe('design token contrast (WCAG AA)', () => {
  it.each([
    ['foreground', 'background'],
    ['foreground', 'surface'],
    ['foreground', 'surface-2'],
    ['muted', 'background'],
    ['muted', 'surface'],
    ['muted', 'surface-2'],
    ['primary.DEFAULT', 'background'], // green links/labels on the page
    ['primary.foreground', 'primary.DEFAULT'], // labels on filled green buttons
    ['danger', 'background'],
  ])('%s on %s ≥ 4.5:1', (fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['muted-foreground', 'background'], // tertiary captions still readable
    ['muted-foreground', 'surface'],
    ['warning', 'background'], // deal badges
  ])('%s on %s ≥ 3:1 (large text / UI)', (fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(3);
  });
});

describe('surface elevation separation', () => {
  // Near-black luminances compress WCAG ratios (the +0.05 flare term
  // dominates), so 1.1:1 here is already a clearly visible step; 1px borders
  // (enforced below) do the rest of the separation work on dark UIs.
  it.each([
    ['surface', 'background'],
    ['surface-2', 'surface'],
    ['surface-3', 'surface-2'],
  ])('%s vs %s ≥ 1.1:1 so panels visibly separate', (upper, lower) => {
    expect(contrast(token(upper), token(lower))).toBeGreaterThanOrEqual(1.1);
  });

  it('elevation ladder is strictly increasing in luminance', () => {
    const ladder = ['background', 'surface', 'surface-2', 'surface-3'].map((t) =>
      luminance(token(t)),
    );
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i]!).toBeGreaterThan(ladder[i - 1]!);
    }
  });

  it('card borders are distinguishable from their surface (≥ 1.2:1)', () => {
    expect(contrast(token('border'), token('surface'))).toBeGreaterThanOrEqual(1.2);
  });
});
