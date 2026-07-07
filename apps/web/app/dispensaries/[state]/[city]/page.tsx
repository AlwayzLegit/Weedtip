import type { Metadata } from 'next';
import { cache } from 'react';
import { Link } from 'next-view-transitions';
import { notFound } from 'next/navigation';
import { PRODUCT_CATEGORIES, type OperatingHours } from '@weedtip/shared';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { DispensariesBrowser } from '@/components/dispensaries-browser';
import { FaqSection } from '@/components/seo/faq-section';
import { JsonLd } from '@/components/seo/json-ld';
import { dealBadge } from '@/lib/format';
import { citySlug, itemListJsonLd, pageSeo, US_STATES } from '@/lib/seo';
import { getRegionPlacements, resolveGeo, type ResolvedGeo } from '@/lib/ad-serving';
import { RegionSearchBeacon } from '@/components/ads/region-search-beacon';
import { SponsorHero, type SponsorHeroData } from '@/components/ads/sponsor-hero';
import { createStaticClient } from '@/lib/supabase/static';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { STATE_BOUNDS, US_BOUNDS, type BBox } from '@/lib/us-state-bounds';

// Public, anon-only page — serve cached HTML and refresh every 60 min (ISR).
export const revalidate = 3600;

const LOCATION_SELECT =
  'id,slug,name,city,state,cover_image_url,logo_url,is_delivery,is_pickup,is_medical,is_recreational,featured,rating_avg,rating_count,latitude,longitude,hours,timezone';

// Cached per request so generateMetadata + the page don't each run the query.
const loadCity = cache(async function loadCity(state: string, city: string) {
  const code = state.toUpperCase();
  const stateName = US_STATES[code];
  if (!stateName) return null;
  const supabase = createStaticClient();
  // Page past the 1k cap: in large states a city's shops can all sort beyond
  // row 1,000, which previously 404'd valid (and sitemap-listed) city pages.
  const data = await fetchAll<{ id: string; slug: string; name: string; city: string | null; state: string; cover_image_url: string | null; logo_url: string | null; is_delivery: boolean; is_pickup: boolean; is_medical: boolean; is_recreational: boolean; featured: boolean; rating_avg: number; rating_count: number; latitude: number | null; longitude: number | null; hours: unknown; timezone: string | null }>(
    (from, to) =>
      supabase
        .from('dispensaries')
        .select(LOCATION_SELECT)
        .eq('status', 'active')
        .eq('state', code)
        .order('name')
        .range(from, to),
  );
  const shops = data.filter((s) => citySlug(s.city ?? '') === city.toLowerCase());
  const first = shops[0];
  if (!first) return null;

  // Nearby-city directory: the state query above already holds every shop in
  // the state, so neighboring markets cost nothing extra. Compare city
  // centroids and keep the six closest (falls back to biggest markets when
  // coordinates are missing).
  const cityAgg = new Map<
    string,
    { count: number; latSum: number; lngSum: number; located: number }
  >();
  for (const s of data) {
    if (!s.city || citySlug(s.city) === city.toLowerCase()) continue;
    const agg = cityAgg.get(s.city) ?? { count: 0, latSum: 0, lngSum: 0, located: 0 };
    agg.count += 1;
    if (typeof s.latitude === 'number' && typeof s.longitude === 'number') {
      agg.latSum += s.latitude;
      agg.lngSum += s.longitude;
      agg.located += 1;
    }
    cityAgg.set(s.city, agg);
  }
  const located = shops.filter(
    (s) => typeof s.latitude === 'number' && typeof s.longitude === 'number',
  );
  const hereLat = located.length
    ? located.reduce((sum, s) => sum + s.latitude!, 0) / located.length
    : null;
  const hereLng = located.length
    ? located.reduce((sum, s) => sum + s.longitude!, 0) / located.length
    : null;
  const nearbyCities = [...cityAgg.entries()]
    .map(([name, agg]) => ({
      name,
      count: agg.count,
      distance:
        hereLat != null && agg.located > 0
          ? Math.hypot(
              agg.latSum / agg.located - hereLat,
              (agg.lngSum / agg.located - hereLng!) * Math.cos((hereLat * Math.PI) / 180),
            )
          : Infinity,
    }))
    .sort((a, b) => a.distance - b.distance || b.count - a.count)
    .slice(0, 6);

  // Service mix + name-drops for the generated market copy (facts only — no
  // rating claims until the review base exists).
  const stats = {
    delivery: shops.filter((s) => s.is_delivery).length,
    pickup: shops.filter((s) => s.is_pickup).length,
    medical: shops.filter((s) => s.is_medical).length,
    recreational: shops.filter((s) => s.is_recreational).length,
    withHours: shops.filter((s) => s.hours != null).length,
  };
  const notableSeen = new Set<string>();
  const notable = [...shops]
    .sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) ||
        Number(!!b.cover_image_url) - Number(!!a.cover_image_url) ||
        b.rating_count - a.rating_count ||
        a.name.localeCompare(b.name),
    )
    // Chains repeat a name across locations — one entry per display name so the
    // copy never reads "Affinity, and Affinity".
    .filter((s) => {
      const key = s.name.trim().toLowerCase();
      if (notableSeen.has(key)) return false;
      notableSeen.add(key);
      return true;
    })
    .slice(0, 3)
    .map((s) => ({ name: s.name, slug: s.slug }));
  const deliveryShops = [
    ...new Set(shops.filter((s) => s.is_delivery).map((s) => s.name.trim())),
  ].slice(0, 3);

  // Geo-scoped featured: live featured placements whose scope matches this
  // location, for shops located here. Pins them to the top with tracking.
  const nowIso = new Date().toISOString();
  const shopIds = shops.map((s) => s.id);
  const { data: featured } = await supabase
    .from('placements')
    .select('id, dispensary_id, priority')
    .eq('type', 'featured')
    .eq('is_active', true)
    .in('dispensary_id', shopIds)
    .lte('starts_at', nowIso)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .or(`scope_state.is.null,scope_state.eq.${code}`)
    .or(`scope_city.is.null,scope_city.ilike.${first.city}`);

  const featuredByDispensary = new Map<string, { placementId: string; priority: number }>();
  for (const f of featured ?? []) {
    if (!f.dispensary_id) continue;
    const prev = featuredByDispensary.get(f.dispensary_id);
    if (!prev || f.priority > prev.priority) {
      featuredByDispensary.set(f.dispensary_id, { placementId: f.id, priority: f.priority });
    }
  }

  // Regional ad placements: resolve the advertiser region from a
  // representative point in this city, then fetch its active paid slots
  // (cached per region). Featured slot-holders pin above organic results,
  // premium slot-holders get a rank boost + Sponsored badge, and the
  // exclusive sponsor renders as a hero unit in EVERY zone of the region.
  let geo: ResolvedGeo | null = null;
  let featuredSlotIds: string[] = [];
  let premiumSlotIds = new Set<string>();
  let sponsor: SponsorHeroData | null = null;
  const anchorShop = shops.find(
    (s) => typeof s.latitude === 'number' && typeof s.longitude === 'number',
  );
  if (anchorShop) {
    geo = await resolveGeo(anchorShop.longitude!, anchorShop.latitude!);
    if (geo) {
      const placements = await getRegionPlacements(geo.regionId);
      const cityShopIds = new Set(shopIds);
      // Rotate the (max 3) featured order per ISR render for fair exposure.
      featuredSlotIds = [...placements.featuredIds]
        .filter((id) => cityShopIds.has(id))
        .sort(() => Math.random() - 0.5);
      premiumSlotIds = new Set(placements.premiumIds.filter((id) => cityShopIds.has(id)));
      if (placements.exclusiveId) {
        // The sponsor may sit in another city of the same region — fetch it.
        const { data: sp } = await supabase
          .from('dispensaries')
          .select('id,slug,name,city,state,cover_image_url,logo_url,rating_avg,rating_count,is_delivery,is_pickup,status')
          .eq('id', placements.exclusiveId)
          .eq('status', 'active')
          .maybeSingle();
        if (sp) {
          sponsor = {
            id: sp.id,
            slug: sp.slug,
            name: sp.name,
            city: sp.city,
            state: sp.state,
            coverImageUrl: sp.cover_image_url,
            logoUrl: sp.logo_url,
            rating: sp.rating_avg,
            reviewCount: sp.rating_count,
            isDelivery: sp.is_delivery,
            isPickup: sp.is_pickup,
          };
        }
      }
    }
  }

  // Serving order: featured slots → legacy featured placements → premium
  // slots → organic A→Z. The exclusive sponsor renders as a separate hero.
  const featuredSlotRank = new Map(featuredSlotIds.map((id, i) => [id, i] as const));
  const rank = (id: string) => {
    if (featuredSlotRank.has(id)) return 0;
    if (featuredByDispensary.has(id)) return 1;
    if (premiumSlotIds.has(id)) return 2;
    return 3;
  };
  const ordered = [...shops].sort((a, b) => {
    const ra = rank(a.id);
    const rb = rank(b.id);
    if (ra !== rb) return ra - rb;
    if (ra === 0) return featuredSlotRank.get(a.id)! - featuredSlotRank.get(b.id)!;
    if (ra === 1) {
      return featuredByDispensary.get(b.id)!.priority - featuredByDispensary.get(a.id)!.priority;
    }
    return 0;
  });

  // Card-family deal badges: each shop's soonest-ending live deal in this city.
  // Filtered through the joined dispensary (state + city) so the query stays
  // small regardless of how many shops the city has.
  const { data: liveDeals } = await supabase
    .from('deals')
    .select('dispensary_id,discount_type,discount_value,dispensary:dispensaries!inner(state,city,status)')
    .eq('is_active', true)
    .lte('start_date', nowIso)
    .gte('end_date', nowIso)
    .eq('dispensary.status', 'active')
    .eq('dispensary.state', code)
    .ilike('dispensary.city', first.city ?? '')
    .order('end_date');
  const dealByDispensary = new Map<string, { type: string; value: number }>();
  for (const d of liveDeals ?? []) {
    if (d.dispensary_id && !dealByDispensary.has(d.dispensary_id)) {
      dealByDispensary.set(d.dispensary_id, { type: d.discount_type, value: d.discount_value });
    }
  }

  return {
    stateName,
    cityName: first.city ?? '',
    shops: ordered,
    featuredByDispensary,
    featuredSlotIds: new Set(featuredSlotIds),
    premiumSlotIds,
    dealByDispensary,
    geo,
    sponsor,
    stats,
    notable,
    deliveryShops,
    nearbyCities,
  };
});

/** Oxford-comma name list for generated copy ("A, B, and C"). */
function nameList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/** Fit the map to the city's shops (padded), falling back to the whole state. */
function cityBounds(
  shops: { latitude: number | null; longitude: number | null }[],
  stateCode: string,
): BBox {
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;
  for (const s of shops) {
    if (typeof s.latitude !== 'number' || typeof s.longitude !== 'number') continue;
    minLat = Math.min(minLat, s.latitude);
    maxLat = Math.max(maxLat, s.latitude);
    minLng = Math.min(minLng, s.longitude);
    maxLng = Math.max(maxLng, s.longitude);
  }
  if (!Number.isFinite(minLat)) return STATE_BOUNDS[stateCode] ?? US_BOUNDS;
  const padLat = Math.max((maxLat - minLat) * 0.15, 0.02);
  const padLng = Math.max((maxLng - minLng) * 0.15, 0.02);
  return [minLng - padLng, minLat - padLat, maxLng + padLng, maxLat + padLat];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string; city: string }>;
}): Promise<Metadata> {
  const { state, city } = await params;
  const found = await loadCity(state, city);
  if (!found) return { title: 'Dispensaries' };
  const title = `Dispensaries in ${found.cityName}, ${state.toUpperCase()}`;
  const description = `Find licensed cannabis dispensaries in ${found.cityName}, ${found.stateName}. Compare menus, deals, hours, and reviews, then order for pickup or delivery on Weedtip.`;
  return pageSeo({
    title,
    description,
    path: `/dispensaries/${state.toLowerCase()}/${city.toLowerCase()}`,
  });
}

export default async function CityDispensariesPage({
  params,
}: {
  params: Promise<{ state: string; city: string }>;
}) {
  const { state, city } = await params;
  const found = await loadCity(state, city);
  if (!found) notFound();
  const {
    stateName,
    cityName,
    shops,
    featuredByDispensary,
    featuredSlotIds,
    premiumSlotIds,
    dealByDispensary,
    geo,
    sponsor,
    stats,
    notable,
    deliveryShops,
    nearbyCities,
  } = found;

  const faqs = [
    {
      question: `How many cannabis dispensaries are in ${cityName}?`,
      answer: `Weedtip lists ${shops.length} licensed ${shops.length === 1 ? 'dispensary' : 'dispensaries'} in ${cityName}, ${stateName}, each with menus, deals, and reviews.`,
    },
    {
      question: `Can I order cannabis for pickup or delivery in ${cityName}?`,
      answer:
        stats.delivery > 0
          ? `Yes — ${stats.pickup} ${cityName} ${stats.pickup === 1 ? 'dispensary offers' : 'dispensaries offer'} in-store pickup and ${stats.delivery} ${stats.delivery === 1 ? 'offers' : 'offer'} delivery${deliveryShops.length > 0 ? `, including ${nameList(deliveryShops)}` : ''}. Each dispensary's page shows the options it supports.`
          : `${stats.pickup} ${cityName} ${stats.pickup === 1 ? 'dispensary offers' : 'dispensaries offer'} in-store pickup. None currently list delivery in ${cityName} — check the delivery directory for services covering the wider area.`,
    },
    ...(stats.medical > 0
      ? [
          {
            question: `Do dispensaries in ${cityName} serve medical patients?`,
            answer: `Yes — ${stats.medical} of ${cityName}'s ${shops.length} ${shops.length === 1 ? 'dispensary serves' : 'dispensaries serve'} medical patients${stats.recreational > 0 ? `, and ${stats.recreational} ${stats.recreational === 1 ? 'serves' : 'serve'} recreational customers 21+` : ''}. Filter the list above by medical or recreational to match your needs.`,
          },
        ]
      : []),
    {
      question: `Do I need to be 21 to buy cannabis in ${cityName}?`,
      answer: `You must be 21 or older (or a qualifying medical patient where permitted) and present a valid government-issued ID at pickup or delivery.`,
    },
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <JsonLd data={itemListJsonLd(shops.map((s) => `/dispensary/${s.slug}`))} />
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Dispensaries', href: '/dispensaries' },
          { name: stateName, href: `/dispensaries/${state.toLowerCase()}` },
          { name: cityName, href: `/dispensaries/${state.toLowerCase()}/${city.toLowerCase()}` },
        ]}
      />
      <h1 className="text-2xl font-bold">
        Cannabis dispensaries in {cityName}, {state.toUpperCase()}
      </h1>
      <p className="text-muted mt-1 text-sm">
        {shops.length} {shops.length === 1 ? 'dispensary' : 'dispensaries'} in {cityName}.
      </p>

      {geo && <RegionSearchBeacon regionId={geo.regionId} zoneId={geo.zoneId} />}

      {sponsor && geo && (
        <div className="mt-6">
          <SponsorHero
            d={sponsor}
            regionSlug={geo.regionSlug}
            regionName={geo.regionName}
            zoneSlug={geo.zoneSlug}
            regionId={geo.regionId}
            zoneId={geo.zoneId}
          />
        </div>
      )}

      <div className="mt-6">
        <DispensariesBrowser
          variant="embedded"
          initialBounds={cityBounds(shops, state.toUpperCase())}
          initialTotal={shops.length}
          initialShops={shops.map((s) => {
            const promo = featuredByDispensary.get(s.id);
            const deal = dealByDispensary.get(s.id);
            const slotType = featuredSlotIds.has(s.id)
              ? ('featured' as const)
              : premiumSlotIds.has(s.id)
                ? ('premium' as const)
                : null;
            return {
              id: s.id,
              slug: s.slug,
              name: s.name,
              city: s.city,
              state: s.state,
              coverImageUrl: s.cover_image_url,
              logoUrl: s.logo_url,
              isDelivery: s.is_delivery,
              isPickup: s.is_pickup,
              isMedical: s.is_medical,
              isRecreational: s.is_recreational,
              featured: s.featured || !!promo || slotType === 'featured',
              sponsored: slotType === 'premium',
              placementId: promo?.placementId || undefined,
              adSlot:
                slotType && geo
                  ? {
                      slotType,
                      regionSlug: geo.regionSlug,
                      zoneSlug: geo.zoneSlug,
                      regionId: geo.regionId,
                      zoneId: geo.zoneId,
                      dispensaryId: s.id,
                    }
                  : undefined,
              rating: s.rating_avg,
              reviewCount: s.rating_count,
              lat: s.latitude,
              lng: s.longitude,
              distanceMeters: null,
              // Recomputed live client-side; the page itself is ISR-cached.
              isOpenNow: null,
              hours: (s.hours ?? null) as OperatingHours | null,
              timezone: s.timezone,
              dealBadge: deal ? dealBadge(deal.type, deal.value) : null,
            };
          })}
        />
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Browse {cityName} by category</h2>
        <div className="flex flex-wrap gap-2">
          {PRODUCT_CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/dispensaries/${state.toLowerCase()}/${city.toLowerCase()}/${c.slug}`}
              className="border-border bg-surface hover:border-primary/50 hover:text-primary rounded-full border px-4 py-2 text-sm font-medium transition-colors"
            >
              {c.name}
            </Link>
          ))}
          <Link
            href={`/deals/${state.toLowerCase()}/${city.toLowerCase()}`}
            className="border-primary/30 bg-primary-muted text-primary rounded-full border px-4 py-2 text-sm font-medium hover:underline"
          >
            Deals in {cityName}
          </Link>
        </div>
      </section>

      <section className="mt-12 max-w-3xl">
        <h2 className="mb-2 text-lg font-semibold">
          About cannabis dispensaries in {cityName}
        </h2>
        {/* Generated from live listing data so every city page carries unique,
            factual copy instead of shared boilerplate. */}
        <div className="text-muted space-y-3 text-sm leading-relaxed">
          <p>
            {cityName}, {stateName} has {shops.length} licensed cannabis{' '}
            {shops.length === 1 ? 'dispensary' : 'dispensaries'} listed on Weedtip
            {stats.pickup > 0 && (
              <>
                {' — '}
                {stats.pickup} {stats.pickup === 1 ? 'offers' : 'offer'} in-store pickup
                {stats.delivery > 0 &&
                  ` and ${stats.delivery} ${stats.delivery === 1 ? 'delivers' : 'deliver'} locally`}
              </>
            )}
            .{' '}
            {stats.medical > 0 && stats.recreational > 0
              ? `The market serves both sides: ${stats.recreational} ${stats.recreational === 1 ? 'shop welcomes' : 'shops welcome'} recreational customers 21+ and ${stats.medical} ${stats.medical === 1 ? 'serves' : 'serve'} registered medical patients.`
              : stats.medical > 0
                ? `${cityName}'s ${shops.length === 1 ? 'shop is' : 'shops are'} medical-focused — a valid patient registration is required to purchase.`
                : `${cityName}'s ${shops.length === 1 ? 'shop serves' : 'shops serve'} adult-use customers 21 and older.`}
            {notable.length >= 2 && (
              <>
                {' '}
                Local names to know include{' '}
                {notable.map((n, i) => (
                  <span key={n.slug}>
                    {i > 0 && (i === notable.length - 1 ? ', and ' : ', ')}
                    <Link href={`/dispensary/${n.slug}`} className="text-primary hover:underline">
                      {n.name}
                    </Link>
                  </span>
                ))}
                .
              </>
            )}
          </p>
          <p>
            Compare menus, prices, and current deals above, or narrow the list with the pickup,
            delivery, and open-now filters. Every listing shows hours, services, and directions.
            Bring a valid 21+ ID and check local regulations before ordering.
          </p>
        </div>
      </section>

      {nearbyCities.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Dispensaries near {cityName}</h2>
          <div className="flex flex-wrap gap-2">
            {nearbyCities.map((c) => (
              <Link
                key={c.name}
                href={`/dispensaries/${state.toLowerCase()}/${citySlug(c.name)}`}
                className="border-border bg-surface hover:border-primary/50 hover:text-primary inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors"
              >
                {c.name}
                <span className="text-muted text-xs">({c.count})</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <FaqSection items={faqs} />
    </main>
  );
}
