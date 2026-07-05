import 'server-only';
import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service';
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
 * Live slot availability for every region. Scarcity is the sales pitch, so
 * the numbers must include pending holds — those aren't publicly readable
 * under RLS, hence the service client. Server-only.
 */
export async function getSlotAvailability(): Promise<Map<string, RegionAvailability>> {
  const service = createServiceClient();
  const [{ data: slots }, { data: subs }] = await Promise.all([
    service.from('ad_slots').select('id, region_id, slot_type'),
    service
      .from('ad_subscriptions')
      .select('slot_id')
      .in('status', ['pending', 'active', 'past_due']),
  ]);
  const takenSlotIds = new Set((subs ?? []).map((s) => s.slot_id));

  const byRegion = new Map<string, RegionAvailability>();
  for (const slot of slots ?? []) {
    const entry =
      byRegion.get(slot.region_id) ??
      ({ exclusiveOpen: false, featuredOpen: 0, premiumOpen: 0 } as RegionAvailability);
    const open = !takenSlotIds.has(slot.id);
    if (slot.slot_type === 'exclusive') entry.exclusiveOpen = entry.exclusiveOpen || open;
    else if (slot.slot_type === 'featured' && open) entry.featuredOpen += 1;
    else if (slot.slot_type === 'premium' && open) entry.premiumOpen += 1;
    byRegion.set(slot.region_id, entry);
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
