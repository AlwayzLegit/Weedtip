import { Link } from 'next-view-transitions';
import { ArrowRight, Crown, MapPin, Sparkles } from 'lucide-react';
import { ViewTracker } from '@/components/analytics/view-tracker';
import { Badge } from '@/components/ui/badge';
import { getSlotAvailability } from '@/lib/ad-serving';
import { formatPrice } from '@/lib/format';
import { requireAdvertiserAccess } from '@/lib/advertiser-access';
import { pageSeo } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import { createStaticClient } from '@/lib/supabase/static';

export const metadata = pageSeo({
  title: 'Advertise on Weedtip',
  description:
    'Own your neighborhood. Fixed, scarce ad inventory per region: one exclusive sponsor, three featured positions, ten premium listings.',
  path: '/advertise',
});

// Auth-gated (advertiser accounts only) — always rendered per-request.
export const dynamic = 'force-dynamic';

const TIER_LABEL: Record<string, string> = {
  A_PLUS: 'A+',
  A: 'A',
  B_PLUS: 'B+',
  B: 'B',
};

export default async function AdvertisePage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; all?: string }>;
}) {
  const { shop: shopParam, all: allParam } = await searchParams;
  const showAll = allParam === '1';
  const access = await requireAdvertiserAccess('/advertise');
  const supabase = createStaticClient();
  const [{ data: markets }, { data: regions }, { data: zones }, { data: products }, availability] =
    await Promise.all([
      supabase.from('ad_markets').select('id, slug, name, state').order('name'),
      // ~500 regions nationwide — fine under the 1,000-row response cap.
      // (Paginate here before region count ever approaches 1,000.)
      supabase
        .from('ad_regions')
        .select('id, market_id, slug, name, tier, sort_order')
        .eq('is_active', true)
        .order('sort_order'),
      // Aggregated per region in the DB — the raw ad_zones table is past the
      // PostgREST row cap at nationwide scale.
      supabase.rpc('ad_region_zone_names'),
      supabase.from('ad_products').select('slot_type, tier, launch_price, list_price'),
      getSlotAvailability(),
    ]);

  const zonesByRegion = new Map<string, string[]>();
  for (const z of zones ?? []) {
    zonesByRegion.set(z.region_id, z.zone_names ?? []);
  }
  // Shop owners only see the areas their listings are in — a shop in Missouri
  // has no use for LA rate cards. Admins and brand owners (state/nationwide
  // campaigns) see the full catalog.
  const visibleMarkets = (markets ?? []).filter(
    (m) => !access.applicableStates || access.applicableStates.includes(m.state),
  );

  // Resolve each of the owner's listings to its ad region (polygon match with a
  // nearest-centroid fallback). The catalog then shows ONLY the regions that
  // actually cover their shops — a rate card for a region you have no listing in
  // is noise. `?all=1` opens the full state catalog for deliberate expansion.
  const shopsByRegion = new Map<string, string[]>();
  const myShops: { slug: string; name: string; regionId: string | null }[] = [];
  const authed = await createClient();
  const { data: ownShops } = await authed
    .from('dispensaries')
    .select('slug, name, latitude, longitude')
    .eq('owner_id', access.userId)
    .not('latitude', 'is', null)
    .order('name');
  await Promise.all(
    (ownShops ?? []).map(async (s) => {
      if (typeof s.latitude !== 'number' || typeof s.longitude !== 'number') {
        myShops.push({ slug: s.slug, name: s.name, regionId: null });
        return;
      }
      const { data: geo } = await authed.rpc('resolve_geo', {
        lng: s.longitude,
        lat: s.latitude,
      });
      const regionId = geo?.[0]?.region_id ?? null;
      myShops.push({ slug: s.slug, name: s.name, regionId });
      if (regionId) shopsByRegion.set(regionId, [...(shopsByRegion.get(regionId) ?? []), s.name]);
    }),
  );
  myShops.sort((a, b) => a.name.localeCompare(b.name));

  // Which shop's areas are we showing? An explicit ?shop= wins; otherwise every
  // shop the account owns.
  const selectedShop = shopParam ? (myShops.find((s) => s.slug === shopParam) ?? null) : null;
  const scopedRegionIds = new Set(
    selectedShop
      ? selectedShop.regionId
        ? [selectedShop.regionId]
        : []
      : myShops.flatMap((s) => (s.regionId ? [s.regionId] : [])),
  );
  // Scope only when we actually resolved a region for them; admins and brand
  // owners (state/nationwide campaigns) keep the full catalog unless they pick a
  // shop, and `?all=1` always opens it back up.
  const scopeToShops = !showAll && scopedRegionIds.size > 0;
  const price = (slotType: string, tier: string) =>
    (products ?? []).find((p) => p.slot_type === slotType && p.tier === tier);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <ViewTracker event="advertise_viewed" />
      <div className="max-w-3xl">
        <Badge tone="primary">
          <Sparkles className="h-3 w-3" /> Launch pricing — up to 70% off
        </Badge>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Own your neighborhood.</h1>
        <p className="text-muted mt-3 text-lg">
          Weedtip sells advertising by <span className="text-foreground font-medium">region</span> —
          real territories with fixed, scarce inventory. Each region has exactly{' '}
          <span className="text-foreground font-medium">1 exclusive sponsor</span>,{' '}
          <span className="text-foreground font-medium">3 featured positions</span>, and{' '}
          <span className="text-foreground font-medium">10 premium listings</span>. When
          they&apos;re gone, they&apos;re gone.
        </p>
      </div>

      {/* Which listing are we buying for? Scopes the catalog to that shop's region. */}
      {myShops.length > 1 && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-muted text-sm">Buying for:</span>
          <Link
            href="/advertise"
            className={
              'focus-visible:ring-primary rounded-full border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 ' +
              (!selectedShop && !showAll
                ? 'border-primary bg-primary-muted text-primary'
                : 'border-border bg-surface text-muted hover:text-foreground')
            }
          >
            All my listings
          </Link>
          {myShops.map((s) => (
            <Link
              key={s.slug}
              href={`/advertise?shop=${s.slug}`}
              className={
                'focus-visible:ring-primary rounded-full border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 ' +
                (selectedShop?.slug === s.slug
                  ? 'border-primary bg-primary-muted text-primary'
                  : 'border-border bg-surface text-muted hover:text-foreground')
              }
            >
              {s.name}
            </Link>
          ))}
        </div>
      )}

      {scopeToShops ? (
        <p className="text-muted mt-4 text-sm">
          Showing the {scopedRegionIds.size === 1 ? 'region' : 'regions'} that cover{' '}
          {selectedShop ? selectedShop.name : 'your listings'}.{' '}
          <Link
            href={selectedShop ? `/advertise?shop=${selectedShop.slug}&all=1` : '/advertise?all=1'}
            className="text-primary focus-visible:ring-primary rounded font-medium hover:underline focus-visible:outline-none focus-visible:ring-2"
          >
            Show every region
            {access.applicableStates ? ` in ${access.applicableStates.join(', ')}` : ''} →
          </Link>
        </p>
      ) : (
        <p className="text-muted mt-4 text-sm">
          {access.applicableStates
            ? `Showing every region in ${access.applicableStates.join(', ')}.`
            : 'Showing every live region.'}
          {scopedRegionIds.size > 0 && (
            <>
              {' '}
              <Link
                href={selectedShop ? `/advertise?shop=${selectedShop.slug}` : '/advertise'}
                className="text-primary focus-visible:ring-primary rounded font-medium hover:underline focus-visible:outline-none focus-visible:ring-2"
              >
                Just my {scopedRegionIds.size === 1 ? 'area' : 'areas'} →
              </Link>
            </>
          )}
        </p>
      )}

      {selectedShop && !selectedShop.regionId && !showAll && (
        <div className="rounded-card border-border bg-surface text-muted mt-6 border border-dashed p-6 text-center text-sm">
          <p className="text-foreground font-medium">
            {selectedShop.name} isn&apos;t in a Weedtip ad region yet
          </p>
          <p className="mt-1">
            We open promotion in a market as it grows.{' '}
            <Link href="/advertise?all=1" className="text-primary hover:underline">
              Browse all live regions
            </Link>
            .
          </p>
        </div>
      )}

      {visibleMarkets.length === 0 && (
        <div className="card text-muted mt-10 p-10 text-center text-sm">
          No ad regions are live in your listings&apos; state
          {access.applicableStates && access.applicableStates.length === 1 ? '' : 's'} yet
          {access.applicableStates ? ` (${access.applicableStates.join(', ')})` : ''}. New markets
          open regularly — check back soon.
        </div>
      )}
      {visibleMarkets
        .slice()
        .filter(
          (m) =>
            !scopeToShops ||
            (regions ?? []).some((r) => r.market_id === m.id && scopedRegionIds.has(r.id)),
        )
        .sort((a, b) => {
          const owns = (m: { id: string }) =>
            (regions ?? []).some((r) => r.market_id === m.id && shopsByRegion.has(r.id));
          return Number(owns(b)) - Number(owns(a));
        })
        .map((market) => {
          // Scoped: only the regions covering the selected shop(s). Unscoped: the
          // whole market, with the owner's own regions leading.
          const marketRegions = (regions ?? [])
            .filter((r) => r.market_id === market.id)
            .filter((r) => !scopeToShops || scopedRegionIds.has(r.id))
            .sort((a, b) => Number(shopsByRegion.has(b.id)) - Number(shopsByRegion.has(a.id)));
          if (marketRegions.length === 0) return null;
          return (
            <section key={market.id} className="mt-10">
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <MapPin className="text-primary h-5 w-5" />
                {market.name}, {market.state}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {marketRegions.map((region) => {
                  const avail = availability.get(region.id);
                  const zoneNames = zonesByRegion.get(region.id) ?? [];
                  const featured = price('featured', region.tier);
                  const premium = price('premium', region.tier);
                  const ownShops = shopsByRegion.get(region.id);
                  return (
                    <Link
                      key={region.id}
                      href={`/advertise/${region.slug}`}
                      className={
                        'rounded-card bg-surface shadow-card hover:shadow-card-hover group block border p-5 transition-all duration-200 hover:-translate-y-0.5 ' +
                        (ownShops ? 'border-primary/50' : 'border-border hover:border-primary/50')
                      }
                    >
                      {ownShops && (
                        <Badge tone="primary" className="mb-2">
                          Your area · {ownShops.join(', ')}
                        </Badge>
                      )}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="group-hover:text-primary font-semibold">{region.name}</h3>
                        <Badge tone="outline">Tier {TIER_LABEL[region.tier] ?? region.tier}</Badge>
                      </div>
                      <p className="text-muted mt-1 line-clamp-2 text-xs">
                        {zoneNames.slice(0, 8).join(' · ')}
                        {zoneNames.length > 8 ? ` · +${zoneNames.length - 8} more` : ''}
                      </p>
                      <ul className="mt-3 space-y-1.5 text-sm">
                        <li className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Crown className="text-primary h-3.5 w-3.5" /> Exclusive sponsor
                          </span>
                          {avail?.exclusiveOpen ? (
                            <Badge tone="primary">Available</Badge>
                          ) : (
                            <Badge tone="muted">TAKEN</Badge>
                          )}
                        </li>
                        <li className="flex items-center justify-between">
                          <span>Featured</span>
                          <span
                            className={
                              avail?.featuredOpen ? 'text-primary font-medium' : 'text-muted'
                            }
                          >
                            {avail?.featuredOpen ?? 3} of 3 open
                          </span>
                        </li>
                        <li className="flex items-center justify-between">
                          <span>Premium</span>
                          <span
                            className={
                              avail?.premiumOpen ? 'text-primary font-medium' : 'text-muted'
                            }
                          >
                            {avail?.premiumOpen ?? 10} of 10 open
                          </span>
                        </li>
                      </ul>
                      <p className="border-border text-muted mt-3 flex items-center justify-between border-t pt-3 text-xs">
                        <span>
                          Premium from{' '}
                          <span className="text-foreground font-semibold">
                            {formatPrice(premium?.launch_price ?? 0)}/mo
                          </span>
                          {featured && <> · Featured {formatPrice(featured.launch_price)}/mo</>}
                        </span>
                        <ArrowRight className="group-hover:text-primary h-4 w-4" />
                      </p>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}

      <section className="border-border bg-surface-2 rounded-card mt-12 border p-6 text-sm">
        <h2 className="font-semibold">How it works</h2>
        <ul className="text-muted mt-2 list-disc space-y-1 pl-5">
          <li>
            Shoppers search neighborhoods; your placement covers the whole region — every zone in
            it.
          </li>
          <li>
            Inventory is fixed per region and enforced at the database. No auctions, no getting
            outbid.
          </li>
          <li>
            Reserve with one click — no card needed. Our team sets up monthly invoicing within 1
            business day; launch pricing locks in. Cancel anytime and the slot re-opens instantly.
          </li>
          <li>All sponsored placements are clearly labeled.</li>
        </ul>
      </section>
    </main>
  );
}
