import 'server-only';
import { getAuth } from './auth';
import { getOwnerContext } from './owner';
import { getDispensaryTier, TIER_RANK, tierAtLeast, type PlanTier } from './plan';
import { createClient } from './supabase/server';

/**
 * The catalog of per-account controllable features (GHL-style sub-accounts).
 * Each declares the MINIMUM plan tier that unlocks it; the super-admin can
 * override any one per account (force on/off) via dispensary_feature_overrides.
 *
 * Free keeps the basics deliberately: claim/verify, name + logo + phone + hours,
 * one cover image, and manual product entry. Everything below is paid.
 */
export type FeatureKey =
  // Basic tier — the essentials
  | 'orders'
  | 'website'
  | 'google_sync'
  | 'complete_profile'
  | 'bulk_import'
  // Growth tier — marketing + ops
  | 'deals'
  | 'promos'
  | 'updates'
  | 'taxes'
  | 'analytics'
  | 'team';

export const FEATURES: {
  key: FeatureKey;
  label: string;
  description: string;
  minTier: PlanTier;
}[] = [
  { key: 'orders', label: 'Online orders', description: 'Accept pickup and delivery orders from your listing.', minTier: 'basic' },
  { key: 'website', label: 'Website link', description: 'Show your website on your public listing.', minTier: 'basic' },
  { key: 'google_sync', label: 'Google Business sync', description: 'Pull hours, phone, and details from Google.', minTier: 'basic' },
  { key: 'complete_profile', label: 'Complete profile', description: 'Description, amenities, photo gallery, video, and special hours.', minTier: 'basic' },
  { key: 'bulk_import', label: 'Bulk import & sync', description: 'CSV import and syncing an existing store/POS menu.', minTier: 'basic' },
  { key: 'deals', label: 'Deals & specials', description: 'Percentage, BOGO, and spend-and-save deals.', minTier: 'growth' },
  { key: 'promos', label: 'In-store promos', description: 'Non-menu offers shown on the storefront.', minTier: 'growth' },
  { key: 'updates', label: 'Follower updates', description: 'Broadcast news to followers.', minTier: 'growth' },
  { key: 'taxes', label: 'Tax configuration', description: 'Custom taxes on orders + POS.', minTier: 'growth' },
  { key: 'analytics', label: 'Advanced analytics', description: 'Product/brand/category breakdowns.', minTier: 'growth' },
  { key: 'team', label: 'Team members', description: 'Invite managers + staff to help run the shop.', minTier: 'growth' },
];

const FEATURE_MAP = new Map(FEATURES.map((f) => [f.key, f]));

/** Resolve a feature for a dispensary: admin → override → plan tier. */
export async function canUseFeature(dispensaryId: string, key: FeatureKey): Promise<boolean> {
  const supabase = await createClient();

  // Admins always pass (they manage any shop).
  const { profile } = await getAuth();
  if (profile?.role === 'admin') return true;

  const { data: override } = await supabase
    .from('dispensary_feature_overrides')
    .select('enabled')
    .eq('dispensary_id', dispensaryId)
    .eq('feature_key', key)
    .maybeSingle();
  if (override) return override.enabled;

  const feature = FEATURE_MAP.get(key);
  if (!feature) return false;
  return tierAtLeast(await getDispensaryTier(dispensaryId), feature.minTier);
}

/** Convenience for dashboard pages: resolve a feature for the current owner. */
export async function getOwnerFeature(key: FeatureKey): Promise<boolean> {
  const ctx = await getOwnerContext();
  if (ctx.role === 'admin') return true;
  if (!ctx.dispensary) return false;
  return canUseFeature(ctx.dispensary.id, key);
}

export type FeatureState = {
  key: FeatureKey;
  label: string;
  description: string;
  /** the minimum tier that unlocks this feature. */
  minTier: PlanTier;
  /** true when an admin has explicitly overridden this feature. */
  overridden: boolean;
  /** the override value when overridden. */
  overrideEnabled: boolean | null;
  /** what the plan tier alone would grant. */
  planDefault: boolean;
  /** the resolved effective state. */
  effective: boolean;
};

/**
 * Full feature-state table for the admin sub-account console: for each feature,
 * the plan default, any override, and the resolved effective state.
 */
export async function getFeatureStates(dispensaryId: string): Promise<FeatureState[]> {
  const supabase = await createClient();
  const [{ data: overrides }, tier] = await Promise.all([
    supabase
      .from('dispensary_feature_overrides')
      .select('feature_key, enabled')
      .eq('dispensary_id', dispensaryId),
    getDispensaryTier(dispensaryId),
  ]);
  const overrideMap = new Map((overrides ?? []).map((o) => [o.feature_key, o.enabled]));

  return FEATURES.map((f) => {
    const planDefault = TIER_RANK[tier] >= TIER_RANK[f.minTier];
    const overridden = overrideMap.has(f.key);
    const overrideEnabled = overridden ? (overrideMap.get(f.key) ?? null) : null;
    return {
      ...f,
      overridden,
      overrideEnabled,
      planDefault,
      effective: overridden ? !!overrideEnabled : planDefault,
    };
  });
}
