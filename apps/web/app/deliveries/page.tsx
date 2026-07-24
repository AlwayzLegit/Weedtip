import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import {
  AMENITIES,
  type Amenity,
  dispensaryBoundsSearchSchema,
  dispensarySortSchema,
} from '@weedtip/shared';
import { searchDispensariesBounds } from '@weedtip/supabase/queries';
import { DeliverToInput } from '@/components/deliver-to-input';
import { type BrowseFilters, DispensariesBrowser } from '@/components/dispensaries-browser';
import { FaqSection } from '@/components/seo/faq-section';
import { JsonLd } from '@/components/seo/json-ld';
import { ratingSourceOf } from '@/lib/google-rating';
import { itemListJsonLd, pageSeo, US_STATES } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import { bboxAround, STATE_BOUNDS, US_BOUNDS, type BBox } from '@/lib/us-state-bounds';

export const metadata: Metadata = pageSeo({
  title: 'Cannabis Delivery',
  description:
    'Find licensed cannabis delivery services near you on a live map. Browse menus and deals from dispensaries that deliver on Weedtip.',
  path: '/deliveries',
});

type SearchParams = Record<string, string | string[] | undefined>;

function num(v: string | string[] | undefined): number | undefined {
  if (typeof v !== 'string' || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
const truthy = (v: string | string[] | undefined) => v === 'true';

const FAQS = [
  {
    question: 'How does cannabis delivery work on Weedtip?',
    answer:
      "Browse dispensaries that deliver near you, compare their menus, prices, and deals, and check each shop's page for its delivery area. A valid 21+ ID is required at handoff.",
  },
  {
    question: 'Is cannabis delivery legal near me?',
    answer:
      'Delivery availability depends on your state and local rules. Each dispensary page shows whether it offers delivery in your area.',
  },
  {
    question: 'How long does delivery take?',
    answer:
      'Delivery times vary by dispensary and distance. Order status updates appear in your account once you check out.',
  },
];

/**
 * Delivery discovery on the same map-first shell as /dispensaries: live map,
 * geocoded place search, "search as I move", pin↔card sync — with the
 * delivery filter pre-applied. The viewport picks from shared location >
 * ?state= > the visitor's market cookie > the whole US.
 */
export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const lat = num(sp.lat);
  const lng = num(sp.lng);
  const radius = num(sp.radius_meters) ?? 40_000;

  const amenityRaw = typeof sp.amenities === 'string' ? sp.amenities.split(',') : [];
  const amenities = amenityRaw.filter((a): a is Amenity =>
    (AMENITIES as readonly string[]).includes(a),
  );
  const sortParsed = dispensarySortSchema.safeParse(sp.sort);

  const filters: BrowseFilters = {
    openNow: truthy(sp.open_now),
    deals: truthy(sp.has_deals),
    pickup: truthy(sp.is_pickup),
    // The page's whole point — on unless a shared URL explicitly turned it off.
    delivery: sp.is_delivery === undefined ? true : truthy(sp.is_delivery),
    medical: truthy(sp.is_medical),
    recreational: truthy(sp.is_recreational),
    amenities,
    sort: sortParsed.success ? sortParsed.data : 'default',
    query: typeof sp.query === 'string' ? sp.query.slice(0, 120) : '',
  };

  const stateParam = typeof sp.state === 'string' ? sp.state.toUpperCase() : undefined;
  const marketState = (await cookies()).get('wt_state')?.value?.toUpperCase();
  let bounds: BBox;
  let regionName: string | undefined;
  const origin = lat !== undefined && lng !== undefined ? { lat, lng } : null;
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
    sponsored: ((r as { paid_tier?: number }).paid_tier ?? 0) > 0,
    // Weedtip reviews where they exist, a fresh Google rating otherwise —
    // the RPC decides, the card labels which (see lib/google-rating.ts).
    rating: r.display_rating ?? 0,
    reviewCount: r.display_rating_count ?? 0,
    ratingSource: ratingSourceOf(r.rating_source),
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
          Couldn&apos;t load delivery services. Please try again.
        </p>
      ) : (
        <DispensariesBrowser
          heading={regionName ? `Delivery ${regionName}` : 'Cannabis delivery'}
          initialShops={initialShops}
          initialTotal={total}
          initialBounds={bounds}
          initialFilters={filters}
          initialOrigin={origin}
          noun={{ one: 'delivery service', many: 'delivery services' }}
          variant="page"
          syncUrl
        />
      )}

      <div className="mx-auto max-w-7xl px-4">
        <DeliverToInput className="mt-8 max-w-3xl" />

        <section className="mt-10 max-w-3xl">
          <h2 className="mb-2 text-lg font-semibold">Cannabis delivery near you</h2>
          <p className="text-muted text-sm leading-relaxed">
            Compare licensed dispensaries that deliver cannabis near you on Weedtip. Browse menus,
            prices, and deals, and read reviews to find the right one. Bring a valid 21+ ID at
            handoff and check your local regulations.
          </p>
        </section>
        <FaqSection items={FAQS} />
      </div>
    </main>
  );
}
