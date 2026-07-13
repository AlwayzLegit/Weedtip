import 'server-only';
import { unstable_cache } from 'next/cache';
import { createStaticClient } from '@/lib/supabase/static';

/** Resolved consumer zone + advertiser region for a point. */
export interface ResolvedGeo {
  zoneId: string;
  zoneSlug: string;
  zoneName: string;
  regionId: string;
  regionSlug: string;
  regionName: string;
}

/** Active paid placements for a region, grouped by slot type. */
export interface RegionPlacements {
  /** Dispensary pinned above all results in every zone of the region. */
  exclusiveId: string | null;
  /** Up to 3 rotating premium positions below the sponsor, in slot order. */
  featuredIds: string[];
  /** Up to 10 rank-boosted listings with a Sponsored badge. */
  premiumIds: string[];
}

/**
 * Zone + region for a WGS84 point via the resolve_geo RPC (polygon match with
 * nearest-centroid fallback). Returns null outside any covered market.
 */
export async function resolveGeo(lng: number, lat: number): Promise<ResolvedGeo | null> {
  const supabase = createStaticClient();
  const { data } = await supabase.rpc('resolve_geo', { lng, lat });
  const row = data?.[0];
  if (!row) return null;
  return {
    zoneId: row.zone_id,
    zoneSlug: row.zone_slug,
    zoneName: row.zone_name,
    regionId: row.region_id,
    regionSlug: row.region_slug,
    regionName: row.region_name,
  };
}

/**
 * Active placements for a region, cached per region for 5 minutes so a busy
 * region's zones share one query.
 */
/** Open inventory per region — pending checkouts count as taken. */
export interface RegionAvailability {
  exclusiveOpen: boolean;
  /** Open featured slots (of 3). */
  featuredOpen: number;
  /** Open premium slots (of 10). */
  premiumOpen: number;
}

/**
 * Live slot availability for every region, via the ad_slot_availability RPC
 * (SECURITY DEFINER so pending holds count as taken without exposing who
 * holds them). Aggregated in the database — one row per region — because at
 * nationwide scale the raw ad_slots table exceeds PostgREST's 1,000-row
 * response cap and a whole-table read would silently truncate.
 */
export async function getSlotAvailability(): Promise<Map<string, RegionAvailability>> {
  const supabase = createStaticClient();
  const { data } = await supabase.rpc('ad_slot_availability');

  const byRegion = new Map<string, RegionAvailability>();
  for (const row of data ?? []) {
    byRegion.set(row.region_id, {
      exclusiveOpen: row.exclusive_open,
      featuredOpen: row.featured_open,
      premiumOpen: row.premium_open,
    });
  }
  return byRegion;
}

export function getRegionPlacements(regionId: string): Promise<RegionPlacements> {
  return unstable_cache(
    async (): Promise<RegionPlacements> => {
      const supabase = createStaticClient();
      const { data } = await supabase.rpc('get_region_placements', { p_region_id: regionId });
      const placements: RegionPlacements = { exclusiveId: null, featuredIds: [], premiumIds: [] };
      for (const row of data ?? []) {
        if (row.slot_type === 'exclusive') placements.exclusiveId ??= row.dispensary_id;
        else if (row.slot_type === 'featured') placements.featuredIds.push(row.dispensary_id);
        else if (row.slot_type === 'premium') placements.premiumIds.push(row.dispensary_id);
      }
      return placements;
    },
    ['region-placements', regionId],
    { revalidate: 300 },
  )();
}
