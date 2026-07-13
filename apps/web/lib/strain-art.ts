import type { StrainType } from '@weedtip/shared';

/** Number of generated art variants per strain type under public/art/strains/. */
export const STRAIN_ART_VARIANTS = 8;

/**
 * Deterministic art for a strain: hash the slug onto one of the type's
 * generated variants (public/art/strains/<type>-<n>.webp). Strains don't have
 * their own photography, but hashing per slug keeps a grid of cards visually
 * varied while every strain always shows the same image on every render
 * (SSR/CSR consistent — no hydration mismatch, stable across visits).
 */
export function strainArtUrl(slug: string, type: StrainType): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) | 0;
  const variant = (Math.abs(h) % STRAIN_ART_VARIANTS) + 1;
  return `/art/strains/${type}-${variant}.webp`;
}
