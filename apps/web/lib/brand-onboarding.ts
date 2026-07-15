import type { Tables } from '@weedtip/supabase/types';

export type BrandSetupStep = { key: string; label: string; done: boolean };

/**
 * First-run setup steps for a brand, derived from its current fields + whether
 * it has any catalog products. Mirrors the dispensary setup checklist: a claimed
 * or created brand is only useful to shoppers once it's filled in.
 */
export function brandSetupSteps(
  brand: Pick<Tables<'brands'>, 'logo_url' | 'description' | 'website'>,
  opts: { products: number },
): BrandSetupStep[] {
  return [
    { key: 'logo', label: 'Add your logo', done: !!brand.logo_url },
    { key: 'description', label: 'Write a brand description', done: !!brand.description?.trim() },
    { key: 'website', label: 'Add your website', done: !!brand.website?.trim() },
    { key: 'catalog', label: 'Add your first product', done: opts.products > 0 },
  ];
}

export function brandSetupProgress(steps: BrandSetupStep[]): {
  done: number;
  total: number;
  pct: number;
} {
  const done = steps.filter((s) => s.done).length;
  const total = steps.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}
