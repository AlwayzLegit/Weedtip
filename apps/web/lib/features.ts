import 'server-only';
import { getAuth } from './auth';
import { getOwnerContext } from './owner';
import { dispensaryIsPaid } from './plan';
import { createClient } from './supabase/server';

/**
 * The catalog of per-account controllable features (GHL-style sub-accounts).
 * Each normally follows the dispensary's plan, but the super-admin can override
 * any one per account (force on/off) via dispensary_feature_overrides.
 *
 * `planGated: true` → requires the Growth plan by default; `false` → on for
 * everyone by default (still overridable off by an admin).
 */
export type FeatureKey = 'deals' | 'promos' | 'updates' | 'taxes' | 'analytics' | 'team';

export const FEATURES: {
  key: FeatureKey;
  label: string;
  description: string;
  planGated: boolean;
}[] = [
  { key: 'deals', label: 'Deals & specials', description: 'Percentage, BOGO, and spend-and-save deals.', planGated: true },
  { key: 'promos', label: 'In-store promos', description: 'Non-menu offers shown on the storefront.', planGated: true },
  { key: 'updates', label: 'Follower updates', description: 'Broadcast news to followers.', planGated: true },
  { key: 'taxes', label: 'Tax configuration', description: 'Custom taxes on orders + POS.', planGated: true },
  { key: 'analytics', label: 'Advanced analytics', description: 'Product/brand/category breakdowns.', planGated: true },
  { key: 'team', label: 'Team members', description: 'Invite managers + staff to help run the shop.', planGated: true },
];

const FEATURE_MAP = new Map(FEATURES.map((f) => [f.key, f]));

/** Resolve a feature for a dispensary: override wins, else the plan default. */
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
  if (feature && !feature.planGated) return true;
  return dispensaryIsPaid(dispensaryId);
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
  planGated: boolean;
  /** true when an admin has explicitly overridden this feature. */
  overridden: boolean;
  /** the override value when overridden. */
  overrideEnabled: boolean | null;
  /** what the plan alone would grant. */
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
  const [{ data: overrides }, isPaid] = await Promise.all([
    supabase
      .from('dispensary_feature_overrides')
      .select('feature_key, enabled')
      .eq('dispensary_id', dispensaryId),
    dispensaryIsPaid(dispensaryId),
  ]);
  const overrideMap = new Map((overrides ?? []).map((o) => [o.feature_key, o.enabled]));

  return FEATURES.map((f) => {
    const planDefault = f.planGated ? isPaid : true;
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
