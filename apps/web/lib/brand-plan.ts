import 'server-only';
import { getAuth } from './auth';
import { tierAtLeast, tierFromRank, type PlanTier } from './plan';
import { createClient } from './supabase/server';

/**
 * Brand plan gating — the same Free/Basic/Growth ladder as dispensaries, resolved
 * by the brand_tier() RPC (active brand subscription ∨ grandfathered floor).
 *
 * Free brand: the claim/verify basics — name, logo, and core details, so the
 * brand page still looks right. Basic unlocks the working Brand Studio.
 *
 * NOTE: Promote and Featured bids are deliberately NOT gated. Those are ad
 * purchases — putting a subscription in front of someone trying to spend money
 * with us would block revenue, not protect it.
 */
export type BrandFeatureKey = 'brand_complete_profile' | 'brand_analytics' | 'brand_updates';

export const BRAND_FEATURES: {
  key: BrandFeatureKey;
  label: string;
  description: string;
  minTier: PlanTier;
}[] = [
  {
    key: 'brand_complete_profile',
    label: 'Complete brand profile',
    description: 'Description, website, and the full brand page.',
    minTier: 'basic',
  },
  {
    key: 'brand_analytics',
    label: 'Brand analytics',
    description: 'Views, followers, and catalog performance.',
    minTier: 'basic',
  },
  {
    key: 'brand_updates',
    label: 'Brand updates',
    description: 'Broadcast news to your followers.',
    minTier: 'basic',
  },
];

const BRAND_FEATURE_MAP = new Map(BRAND_FEATURES.map((f) => [f.key, f]));

/** The brand's effective tier (active subscription ∨ grandfathered floor). */
export async function getBrandTier(brandId: string): Promise<PlanTier> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('brand_tier', { p_brand_id: brandId });
  if (error || typeof data !== 'number') return 'free';
  return tierFromRank(data);
}

/** Resolve a brand feature: admins always pass, else compare against the tier. */
export async function canUseBrandFeature(brandId: string, key: BrandFeatureKey): Promise<boolean> {
  const { profile } = await getAuth();
  if (profile?.role === 'admin') return true;
  const feature = BRAND_FEATURE_MAP.get(key);
  if (!feature) return false;
  return tierAtLeast(await getBrandTier(brandId), feature.minTier);
}

/** Shared copy for the upgrade prompt on gated Brand Studio features. */
export const BRAND_UPGRADE_MESSAGE =
  'This is a Basic feature. Upgrade to Basic to publish your catalog, post updates, and see your brand analytics.';
