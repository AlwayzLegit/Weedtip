import 'server-only';
import { hoursSet } from './listing-completeness';
import { createClient } from './supabase/server';

export type PromotionGate = {
  unlocked: boolean;
  /** Human labels for what still needs doing, in checklist order. */
  missing: string[];
};

/**
 * Tiered setup unlock (P-polish): advertising/promotion is EARNED by finishing
 * the listing basics — a half-empty listing in a paid slot burns the buyer's
 * money and the platform's credibility. Requirements: logo, cover photo,
 * hours, and at least 3 menu items.
 */
export async function promotionGate(dispensaryId: string): Promise<PromotionGate> {
  const supabase = await createClient();
  const [{ data: d }, { count: products }] = await Promise.all([
    supabase
      .from('dispensaries')
      .select('logo_url, cover_image_url, hours')
      .eq('id', dispensaryId)
      .maybeSingle(),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('dispensary_id', dispensaryId),
  ]);

  const missing: string[] = [];
  if (!d?.logo_url) missing.push('Add your logo');
  if (!d?.cover_image_url) missing.push('Add a cover photo');
  if (!hoursSet(d?.hours)) missing.push('Set your hours');
  if ((products ?? 0) < 3) missing.push('List at least 3 menu items');
  return { unlocked: missing.length === 0, missing };
}
