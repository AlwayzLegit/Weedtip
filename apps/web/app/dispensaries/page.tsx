import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import {
  AMENITIES,
  type Amenity,
  dispensaryBoundsSearchSchema,
  dispensarySortSchema,
} from '@weedtip/shared';
import { searchDispensariesBounds } from '@weedtip/supabase/queries';
import { type BrowseFilters, DispensariesBrowser } from '@/components/dispensaries-browser';
import { JsonLd } from '@/components/seo/json-ld';
import { itemListJsonLd, pageSeo, US_STATES } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import { bboxAround, STATE_BOUNDS, US_BOUNDS, type BBox } from '@/lib/us-state-bounds';

export const metadata: Metadata = pageSeo({
  title: 'Dispensaries',
  description:
    'Explore licensed cannabis dispensaries on a live map. Filter by open now, pickup, delivery, and more, then view menus, deals, and reviews on Weedtip.',
  path: '/dispensaries',
});

type SearchParams = Record<string, string | string[] | undefined>;

function num(v: string | string[] | undefined): number | undefined {
  if (typeof v !== 'string' || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
const truthy = (v: string | string[] | undefined) => v === 'true';

/**
 * Map-first discovery (Weedmaps/Google Maps pattern). The server picks the
 * opening viewport — shared location > ?state= > the visitor's market cookie >
 * the whole US — and runs the first bounds search; everything after that
 * (pan + "Search this area", filter pills, sort) is the client re-querying
 * the search_dispensaries_bounds RPC directly.
 */
export default async function DispensariesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const lat = num(sp.lat);
  const lng = num(sp.lng);
  const radius = num(sp.radius_meters) ?? 40_000;

  // Amenities arrive comma-separated; keep only known facet keys so a bad URL
  // can't throw the whole page.
  const amenityRaw = typeof sp.amenities === 'string' ? sp.amenities.split(',') : [];
  const amenities = amenityRaw.filter((a): a is Amenity =>
    (AMENITIES as readonly string[]).includes(a),
  );
  const sortParsed = dispensarySortSchema.safeParse(sp.sort);

  const filters: BrowseFilters = {
    openNow: truthy(sp.open_now),
    pickup: truthy(sp.is_pickup),
    delivery: truthy(sp.is_delivery),
    medical: truthy(sp.is_medical),
    recreational: truthy(sp.is_recreational),
    amenities,
    sort: sortParsed.success ? sortParsed.data : 'default',
    query: typeof sp.query === 'string' ? sp.query.slice(0, 120) : '',
    categorySlug: typeof sp.category === 'string' ? sp.category : undefined,
  };

  // Opening viewport: shared location > explicit ?state= > market cookie > US.
  const stateParam = typeof sp.state === 'string' ? sp.state.toUpperCase() : undefined;
  const marketState = (await cookies()).get('wt_state')?.value?.toUpperCase();
  let bounds: BBox;
  let regionName: string | undefined;
  const origin = lat !== undefined && lng !== undefined ? { lat, lng } : null;
  // Geocoded searches ("Los Angeles, CA") carry the place label for the heading.
  const placeName = typeof sp.place === 'string' ? sp.place.slice(0, 80) : undefined;
  if (origin) {
    bounds = bboxAround(origin.lat, origin.lng, Math.min(Math.max(radius, 2_000), 160_000));
    regionName = placeName ? `in ${placeName}` : 'near you';
  } else if (stateParam && STATE_BOUNDS[stateParam]) {
    bounds = STATE_BOUNDS[stateParam];
    regionName = US_STATES[stateParam] ? `in ${US_STATES[stateParam]}` : undefined;
  } else if (marketState && STATE_BOUNDS[marketState]) {
    bounds = STATE_BOUNDS[marketState];
    regionName = US_STATES[marketState] ? `in ${US_STATES[marketState]}` : undefined;
  } else {
    bounds = US_BOUNDS;
  }

  const params = dispensaryBoundsSearchSchema.parse({
    min_lng: bounds[0],
    min_lat: bounds[1],
    max_lng: bounds[2],
    max_lat: bounds[3],
    query: filters.query || undefined,
    is_delivery: filters.delivery || undefined,
    is_pickup: filters.pickup || undefined,
    is_medical: filters.medical || undefined,
    is_recreational: filters.recreational || undefined,
    open_now: filters.openNow || undefined,
    category_slug: filters.categorySlug,
    amenities: amenities.length ? amenities : undefined,
    origin_lat: origin?.lat,
    origin_lng: origin?.lng,
    sort: filters.sort,
    limit: 60,
  });

  const supabase = await createClient();
  const { data, error } = await searchDispensariesBounds(supabase, params);
  const rows = data ?? [];
  const total = rows[0]?.total_count ?? 0;

  const initialShops = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    city: r.city,
    state: r.state,
    coverImageUrl: r.cover_image_url,
    logoUrl: r.logo_url,
    isDelivery: r.is_delivery,
    isPickup: r.is_pickup,
    isMedical: r.is_medical,
    isRecreational: r.is_recreational,
    featured: r.featured,
    rating: r.rating_avg,
    reviewCount: r.rating_count,
    licensed: r.licensed,
    lat: r.latitude,
    lng: r.longitude,
    distanceMeters: r.distance_meters,
    isOpenNow: r.is_open_now,
  }));

  return (
    <main>
      <JsonLd data={itemListJsonLd(initialShops.map((r) => `/dispensary/${r.slug}`))} />
      {error ? (
        <p className="text-danger mx-auto max-w-7xl px-4 py-16 text-center">
          Couldn&apos;t load dispensaries. Please try again.
        </p>
      ) : (
        <DispensariesBrowser
          heading={regionName ? `Dispensaries ${regionName}` : 'Dispensaries'}
          initialShops={initialShops}
          initialTotal={total}
          initialBounds={bounds}
          initialFilters={filters}
          initialOrigin={origin}
          variant="page"
          syncUrl
        />
      )}
    </main>
  );
}
