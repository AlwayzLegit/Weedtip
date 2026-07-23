import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@weedtip/supabase/types';

type Client = SupabaseClient<Database>;

/** Serving-side cap on how many regions a single listing view resolves. */
const MAX_REGIONS = 16;

/**
 * Resolve which ad-regions a listing view should merchandise for. Unscoped
 * views serve the `nationwide` fallback region (the homepage-wide default);
 * a state filter serves that state's metro regions. Ordering keeps nationwide
 * fills first so they read as the top-tier placement.
 */
export async function listingRegionIds(supabase: Client, state?: string | null): Promise<string[]> {
  const { data: nw } = await supabase
    .from('ad_regions')
    .select('id')
    .eq('slug', 'nationwide')
    .maybeSingle();
  const nationwide = nw?.id ? [nw.id] : [];

  if (!state) return nationwide;

  const { data: stateRegions } = await supabase
    .from('ad_regions')
    .select('id, market:ad_markets!inner(state)')
    .eq('market.state', state)
    .eq('is_active', true)
    .neq('slug', 'nationwide')
    .limit(MAX_REGIONS);
  const ids = (stateRegions ?? []).map((r) => r.id);
  // Nationwide first, then the state's metros — de-duped.
  return [...new Set([...nationwide, ...ids])];
}

/**
 * Ordered, de-duped brand ids featured (sold or comped) across the given
 * regions, resolved through the SECURITY DEFINER serving RPC so anon visitors
 * can read the owner-restricted subscriptions.
 */
export async function regionFeaturedBrandIds(
  supabase: Client,
  regionIds: string[],
): Promise<string[]> {
  if (regionIds.length === 0) return [];
  const results = await Promise.all(
    regionIds.map((id) => supabase.rpc('get_region_featured_brands', { p_region_id: id })),
  );
  const ordered: string[] = [];
  for (const { data } of results) {
    for (const row of data ?? []) if (row.brand_id) ordered.push(row.brand_id);
  }
  return [...new Set(ordered)];
}

/** Ordered, de-duped product ids featured across the given regions. */
export async function regionFeaturedProductIds(
  supabase: Client,
  regionIds: string[],
): Promise<string[]> {
  if (regionIds.length === 0) return [];
  const results = await Promise.all(
    regionIds.map((id) => supabase.rpc('get_region_featured_products', { p_region_id: id })),
  );
  const ordered: string[] = [];
  for (const { data } of results) {
    for (const row of data ?? []) if (row.product_id) ordered.push(row.product_id);
  }
  return [...new Set(ordered)];
}
