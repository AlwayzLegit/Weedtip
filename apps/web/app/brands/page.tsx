import type { Metadata } from 'next';
import { Link } from 'next-view-transitions';
import { Sparkles } from 'lucide-react';
import { BrandTile } from '@/components/brand/brand-tile';
import { PlacementBeacon } from '@/components/placement-beacon';
import { SponsoredBadge } from '@/components/sponsored-badge';
import { listingRegionIds, regionFeaturedBrandIds } from '@/lib/region-merch';
import { pageSeo } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = pageSeo({
  title: 'Brands',
  description:
    'Browse cannabis brands by state and find their products at dispensaries near you on Weedtip.',
  path: '/brands',
});

type FeaturedCard = {
  key: string;
  placementId: string | null;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
};

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const supabase = await createClient();
  const { state: stateParam } = await searchParams;

  const [{ data: brands }, { data: prodBrands }, { data: lineupRows }] = await Promise.all([
    supabase
      .from('brands')
      .select('id,slug,name,description,logo_url,rating_avg,rating_count')
      .order('name'),
    supabase
      .from('products')
      .select('brand_id, dispensary:dispensaries!inner(status,state)')
      .eq('dispensary.status', 'active')
      .not('brand_id', 'is', null),
    // Official lineup sizes — the count shown when a brand isn't on any
    // dispensary menu yet (previously ~211 of 216 cards read "0 products").
    supabase.from('brand_products').select('brand_id'),
  ]);

  // Per-brand total + per-state product counts (a brand's states = the states of
  // the active dispensaries that carry it).
  const countByBrand = new Map<string, number>();
  const brandStateCount = new Map<string, Map<string, number>>();
  const stateBrandSets = new Map<string, Set<string>>();
  for (const p of prodBrands ?? []) {
    if (!p.brand_id) continue;
    countByBrand.set(p.brand_id, (countByBrand.get(p.brand_id) ?? 0) + 1);
    const st = (p.dispensary as { state: string } | null)?.state;
    if (!st) continue;
    let m = brandStateCount.get(p.brand_id);
    if (!m) {
      m = new Map();
      brandStateCount.set(p.brand_id, m);
    }
    m.set(st, (m.get(st) ?? 0) + 1);
    if (!stateBrandSets.has(st)) stateBrandSets.set(st, new Set());
    stateBrandSets.get(st)!.add(p.brand_id);
  }

  // States a shopper can filter to — those with organic brand coverage.
  const allStates = [...stateBrandSets.keys()].sort();
  const selectedState = stateParam && allStates.includes(stateParam) ? stateParam : null;

  const lineupCountByBrand = new Map<string, number>();
  for (const r of lineupRows ?? []) {
    lineupCountByBrand.set(r.brand_id, (lineupCountByBrand.get(r.brand_id) ?? 0) + 1);
  }

  const ranked = (brands ?? [])
    .map((b) => {
      const storeCount = selectedState
        ? (brandStateCount.get(b.id)?.get(selectedState) ?? 0)
        : (countByBrand.get(b.id) ?? 0);
      const lineupCount = lineupCountByBrand.get(b.id) ?? 0;
      return { ...b, count: storeCount, lineupCount };
    })
    .filter((b) => (selectedState ? b.count > 0 : true))
    .sort(
      (a, b) => b.count - a.count || b.lineupCount - a.lineupCount || a.name.localeCompare(b.name),
    );

  // Featured strip = region ad-slot fills (the one unified merchandising system):
  // brands sold or comped into this view's region(s).
  let regionCards: FeaturedCard[] = [];
  {
    const regionIds = await listingRegionIds(supabase, selectedState);
    const brandIds = await regionFeaturedBrandIds(supabase, regionIds);
    if (brandIds.length) {
      const { data: rb } = await supabase
        .from('brands')
        .select('id,slug,name,description,logo_url')
        .in('id', brandIds);
      const byId = new Map((rb ?? []).map((b) => [b.id, b]));
      regionCards = brandIds.flatMap((id) => {
        const b = byId.get(id);
        return b
          ? [
              {
                key: `r-${b.id}`,
                placementId: null as string | null,
                slug: b.slug,
                name: b.name,
                description: b.description,
                logo_url: b.logo_url,
              },
            ]
          : [];
      });
    }
  }

  const seenFeatured = new Set<string>();
  const featuredCards = [...regionCards].filter((c) => {
    if (seenFeatured.has(c.slug)) return false;
    seenFeatured.add(c.slug);
    return true;
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-4">
        <p className="eyebrow mb-1">Discover</p>
        <h1 className="text-2xl font-bold sm:text-3xl">
          Brands{selectedState ? ` in ${selectedState}` : ''}
        </h1>
        <p className="text-muted mt-1">Discover brands and where to find their products.</p>
      </div>

      {/* State division */}
      {allStates.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Link
            href="/brands"
            className={
              selectedState
                ? 'border-border text-muted hover:text-foreground rounded-full border px-3 py-1 text-sm'
                : 'border-primary bg-primary-muted text-primary rounded-full border px-3 py-1 text-sm font-medium'
            }
          >
            All states
          </Link>
          {allStates.map((st) => {
            const n = stateBrandSets.get(st)?.size ?? 0;
            return (
              <Link
                key={st}
                href={`/brands?state=${st}`}
                className={
                  selectedState === st
                    ? 'border-primary bg-primary-muted text-primary rounded-full border px-3 py-1 text-sm font-medium'
                    : 'border-border text-muted hover:text-foreground rounded-full border px-3 py-1 text-sm'
                }
              >
                {st}
                {n > 0 ? ` (${n})` : ''}
              </Link>
            );
          })}
        </div>
      )}

      {featuredCards.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-1.5">
            <Sparkles className="text-primary h-4 w-4" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              Featured brands{selectedState ? ` · ${selectedState}` : ''}
            </h2>
            <span className="text-muted text-xs">· Sponsored</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredCards.map((c) => (
              <Link
                key={c.key}
                href={`/brand/${c.slug}`}
                className="rounded-card border-primary/40 bg-primary-muted/30 shadow-card hover:border-primary hover:shadow-card-hover ring-primary/10 relative flex items-start gap-4 border p-5 ring-1 transition-all duration-200 hover:-translate-y-0.5"
              >
                {c.placementId && <PlacementBeacon placementId={c.placementId} />}
                <SponsoredBadge className="absolute right-3 top-3" />
                {c.logo_url ? (
                  <img
                    src={c.logo_url}
                    alt={c.name}
                    className="bg-surface-2 border-border h-12 w-12 shrink-0 rounded-xl border object-contain p-1"
                  />
                ) : (
                  <span className="bg-primary-muted text-primary ring-primary/20 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold ring-1">
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <h3 className="font-semibold">{c.name}</h3>
                  {c.description && (
                    <p className="text-muted mt-1 line-clamp-2 text-sm">{c.description}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {ranked.length === 0 ? (
        <div className="card text-muted p-10 text-center">
          {featuredCards.length > 0 && selectedState
            ? `No other brands listed in ${selectedState} yet.`
            : `No brands${selectedState ? ` in ${selectedState}` : ' yet'}.`}
        </div>
      ) : (
        // Weedmaps-style tile grid: artwork-forward square logo tiles.
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
          {ranked.map((b) => {
            // Data-backed status chip (Weedmaps' tile badge): well-reviewed
            // brands read "Top rated"; broadly-stocked ones "Popular".
            const badge =
              b.rating_count >= 3 && b.rating_avg >= 4.5
                ? 'Top rated'
                : b.count >= 20
                  ? 'Popular'
                  : null;
            return (
              <BrandTile
                key={b.slug}
                slug={b.slug}
                name={b.name}
                logoUrl={b.logo_url}
                rating={b.rating_avg}
                ratingCount={b.rating_count}
                badge={badge}
                sub={
                  b.count > 0
                    ? `${b.count} ${b.count === 1 ? 'product' : 'products'} in stores${selectedState ? ` in ${selectedState}` : ''}`
                    : b.lineupCount > 0
                      ? `${b.lineupCount} in lineup`
                      : 'New brand'
                }
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
