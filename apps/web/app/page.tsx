import { Link } from 'next-view-transitions';
import { ArrowRight, MapPin } from 'lucide-react';
import type { OperatingHours } from '@weedtip/shared';
import { CategoryTiles } from '@/components/home/category-tiles';
import { HeroCarousel, type HeroSlide } from '@/components/home/hero-carousel';
import { MarketFeed, type FeedDeal, type FeedShop } from '@/components/home/market-feed';
import { RegionGrid, type RegionEntry } from '@/components/home/region-grid';
import { ScrollCarousel } from '@/components/home/scroll-carousel';
import { BrandTile } from '@/components/brand/brand-tile';
import { LogoImage } from '@/components/logo-image';
import { ProductCard } from '@/components/product-card';
import { SearchBar } from '@/components/search-bar';
import { ArticleCard } from '@/components/article-card';
import { StrainCard } from '@/components/strain-card';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/ui/reveal';
import { CATALOG_IMAGE_EMBED, cardImageUrl } from '@/lib/catalog';
import { ARTICLES } from '@/lib/learn';
import { citySlug, US_STATES } from '@/lib/seo';
import { createStaticClient } from '@/lib/supabase/static';

// Public, anon-only page — serve cached HTML and refresh every 5 min (ISR).
export const revalidate = 300;

const DISP_FIELDS =
  'slug,name,city,state,cover_image_url,logo_url,is_delivery,is_pickup,is_medical,is_recreational,rating_avg,rating_count,status';

function SectionHeading({
  eyebrow,
  title,
  href,
}: {
  eyebrow?: string;
  title: string;
  href?: string;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="shrink-0">
          <Button variant="ghost" size="sm">
            View all <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  const supabase = createStaticClient();
  const nowIso = new Date().toISOString();

  const [
    { data: featured },
    { data: categories },
    { data: heroPlacements },
    { data: deals },
    { data: popular },
    { data: brands },
    { data: lineupSizes },
    { data: deliveryShops },
    { data: regions },
    { data: strains },
  ] = await Promise.all([
    supabase
      .from('dispensaries')
      .select(
        'slug,name,city,state,cover_image_url,logo_url,is_delivery,is_pickup,is_medical,is_recreational,featured,rating_avg,rating_count,hours,timezone,license_number',
      )
      .eq('status', 'active')
      // Photo-backed only: these seed the hero carousel + featured rail, both
      // merchandising surfaces that must never render image-less or thin.
      .not('cover_image_url', 'is', null)
      .order('featured', { ascending: false })
      .order('rating_count', { ascending: false })
      .limit(12),
    supabase.from('categories').select('name,slug').order('sort_order'),
    supabase
      .from('placements')
      .select(`id,priority,dispensary:dispensaries(${DISP_FIELDS})`)
      .eq('type', 'hero')
      .eq('is_active', true)
      .lte('starts_at', nowIso)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order('priority', { ascending: false })
      .limit(4),
    supabase
      .from('deals')
      .select(
        'id,title,description,code,discount_type,discount_value,dispensary:dispensaries!inner(slug,name,city,state,status)',
      )
      .eq('is_active', true)
      .lte('start_date', nowIso)
      .gte('end_date', nowIso)
      .eq('dispensary.status', 'active')
      .order('end_date')
      .limit(12),
    supabase
      .from('products')
      .select(
        `id,name,brand,price_cents,image_urls,strain_type,thc_percentage,in_stock,rating_avg,rating_count,dispensary:dispensaries!inner(slug,status),category:categories(slug), ${CATALOG_IMAGE_EMBED}`,
      )
      .eq('dispensary.status', 'active')
      .eq('in_stock', true)
      .order('rating_count', { ascending: false })
      .order('rating_avg', { ascending: false })
      .limit(12),
    supabase.from('brands').select('id,slug,name,logo_url,rating_avg,rating_count').order('name'),
    supabase.from('brand_products').select('brand_id'),
    supabase
      .from('dispensaries')
      .select(
        'slug,name,city,state,cover_image_url,logo_url,is_delivery,is_pickup,is_medical,is_recreational,featured,rating_avg,rating_count,hours,timezone,license_number',
      )
      .eq('status', 'active')
      .eq('is_delivery', true)
      .order('rating_count', { ascending: false })
      .limit(12),
    supabase.rpc('region_directory', { top_cities_limit: 5 }),
    supabase
      .from('strains')
      .select('slug,name,type,effects,thc_low,thc_high')
      .order('saves_count', { ascending: false })
      .order('name')
      .limit(10),
  ]);

  const heroSlides: HeroSlide[] = (heroPlacements ?? [])
    .map((p) => ({ placementId: p.id, d: p.dispensary as Record<string, unknown> | null }))
    .filter(
      (s): s is { placementId: string; d: Record<string, unknown> } =>
        !!s.d && s.d.status === 'active',
    )
    .map(({ placementId, d }) => ({
      placementId,
      slug: String(d.slug),
      name: String(d.name),
      city: String(d.city),
      state: String(d.state),
      coverUrl: (d.cover_image_url as string | null) ?? null,
      rating: (d.rating_avg as number | null) ?? null,
      reviewCount: (d.rating_count as number) ?? 0,
    }));

  // The hero band is a merchandising surface — it should never sit empty.
  // Unsold slots fill with organic top shops (with cover photos), badged
  // "Featured" instead of "Sponsored" and untracked.
  if (heroSlides.length < 4) {
    const sold = new Set(heroSlides.map((s) => s.slug));
    for (const d of featured ?? []) {
      if (heroSlides.length >= 4) break;
      if (sold.has(d.slug) || !d.cover_image_url || !d.city) continue;
      heroSlides.push({
        placementId: '',
        slug: d.slug,
        name: d.name,
        city: d.city,
        state: d.state,
        coverUrl: d.cover_image_url,
        rating: d.rating_avg,
        reviewCount: d.rating_count,
      });
    }
  }

  // Nationwide defaults for the location-aware feed; the client swaps in the
  // visitor's market after hydration (wt_state cookie).
  const initialShops: FeedShop[] = (featured ?? []).map((d) => ({
    slug: d.slug,
    name: d.name,
    city: d.city,
    state: d.state,
    coverImageUrl: d.cover_image_url,
    logoUrl: d.logo_url,
    isDelivery: d.is_delivery,
    isPickup: d.is_pickup,
    isMedical: d.is_medical,
    isRecreational: d.is_recreational,
    featured: d.featured,
    rating: d.rating_avg,
    reviewCount: d.rating_count,
    hours: (d.hours ?? null) as OperatingHours | null,
    timezone: d.timezone,
    licensed: !!d.license_number,
  }));
  const initialDeals: FeedDeal[] = (deals ?? []).flatMap((deal) => {
    const disp = deal.dispensary as unknown as {
      slug: string;
      name: string;
      city: string | null;
      state: string;
    } | null;
    if (!disp) return [];
    return [
      {
        id: deal.id,
        title: deal.title,
        description: deal.description,
        code: deal.code,
        discountType: deal.discount_type,
        discountValue: deal.discount_value,
        dispensarySlug: disp.slug,
        dispensaryName: disp.name,
        city: disp.city ?? '',
        state: disp.state,
      },
    ];
  });

  // Top brands by official lineup size — the merchandised brand rail.
  const lineupByBrand = new Map<string, number>();
  for (const r of lineupSizes ?? []) {
    if (r.brand_id) lineupByBrand.set(r.brand_id, (lineupByBrand.get(r.brand_id) ?? 0) + 1);
  }
  // Logo-backed brands only — this is a visual rail, and letter tiles at 14-up
  // read as missing assets. (74 brands carry logos; all have products.)
  const topBrands = (brands ?? [])
    .map((b) => ({ ...b, products: lineupByBrand.get(b.id) ?? 0 }))
    .filter((b) => b.products > 0 && b.logo_url)
    .sort((a, b) => b.products - a.products)
    .slice(0, 14);

  const regionEntries: RegionEntry[] = (regions ?? []).map((r) => ({
    state: r.state,
    dispensaryCount: r.dispensary_count,
    topCities: (r.top_cities as { city: string; count: number }[] | null) ?? [],
  }));

  // Popular cities (Weedmaps SEO pattern): the biggest city markets across all
  // states, as direct links into the map-first city pages.
  const popularCities = regionEntries
    .flatMap((r) => r.topCities.map((c) => ({ ...c, state: r.state })))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // Top markets get visible links; the long tail collapses (Weedmaps keeps
  // its full geo directory off the homepage entirely).
  const topStates = [...regionEntries]
    .sort((a, b) => b.dispensaryCount - a.dispensaryCount)
    .slice(0, 8);


  return (
    <main>
      {/* Organization + WebSite JSON-LD now render sitewide from the root layout. */}

      {/* Promo hero carousel FIRST (Weedmaps order) — this is the money-making
          merchandising surface dispensaries and brands buy into. */}
      {heroSlides.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 pt-6">
          <HeroCarousel slides={heroSlides} />
        </div>
      )}

      {/* Search band — task-first like Weedmaps: what you can do, then the box. */}
      <section className="border-border/70 bg-hero-glow relative overflow-hidden border-b">
        <div className="relative mx-auto max-w-3xl px-4 py-10 text-center sm:py-12">
          <h1 className="animate-slide-up text-3xl font-bold tracking-tight sm:text-4xl">
            Find cannabis near you
          </h1>
          <p className="text-muted mx-auto mt-3 max-w-xl">
            Browse menus, deals, and reviews from licensed dispensaries — order for pickup or
            delivery.
          </p>
          <div className="mx-auto mt-6 max-w-2xl">
            <SearchBar size="lg" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:space-y-16 sm:py-16">
        {/* Weedmaps section order: dispensaries near you → deliveries → deals,
            then categories, brands, strains, products, learn, geo links. */}
        <MarketFeed initialShops={initialShops} initialDeals={initialDeals}>
          {deliveryShops && deliveryShops.length > 0 && (
            <section>
              <SectionHeading eyebrow="To your door" title="Delivery services" href="/deliveries" />
              {/* Compact logo rows, not cover cards — delivery listings rarely
                  have storefront photos, and a rail of empty frames reads as
                  missing assets. */}
              <ScrollCarousel itemClassName="w-64" ariaLabel="Delivery services">
                {deliveryShops.map((d) => (
                  <Link
                    key={d.slug}
                    href={`/dispensary/${d.slug}`}
                    prefetch={false}
                    className="card card-interactive flex h-full items-center gap-3 p-4"
                  >
                    <LogoImage
                      src={d.logo_url}
                      name={d.name}
                      hideWhenEmpty={false}
                      className="h-11 w-11 shrink-0"
                      rounded="rounded-xl"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{d.name}</span>
                      <span className="text-muted block truncate text-xs">
                        {d.city ? `${d.city}, ${d.state}` : `Delivery · ${d.state}`}
                        {d.rating_avg > 0
                          ? ` · ★ ${d.rating_avg.toFixed(1)}`
                          : d.license_number
                            ? ' · Licensed'
                            : ''}
                      </span>
                    </span>
                  </Link>
                ))}
              </ScrollCarousel>
            </section>
          )}
        </MarketFeed>

        {/* Shop by category */}
        <Reveal>
          <section>
            <SectionHeading eyebrow="Explore" title="Shop by category" href="/products" />
            <CategoryTiles categories={categories ?? []} />
          </section>
        </Reveal>

        {/* Featured brands */}
        {topBrands.length > 0 && (
          <Reveal>
          <section>
            <SectionHeading eyebrow="Official lineups" title="Featured brands" href="/brands" />
            {/* Weedmaps-style square logo tiles — artwork-forward, name below. */}
            <ScrollCarousel itemClassName="w-44 sm:w-52" ariaLabel="Popular brands">
              {topBrands.map((b) => (
                <BrandTile
                  key={b.slug}
                  slug={b.slug}
                  name={b.name}
                  logoUrl={b.logo_url}
                  rating={b.rating_avg}
                  ratingCount={b.rating_count}
                  sub={b.products > 0 ? `${b.products} products` : null}
                />
              ))}
            </ScrollCarousel>
          </section>
          </Reveal>
        )}

        {/* Popular strains (Weedmaps pattern — the strain library is a core
            discovery surface, not a buried hub page) */}
        {strains && strains.length > 0 && (
          <Reveal>
          <section>
            <SectionHeading eyebrow="Know your high" title="Popular strains" href="/strains" />
            <ScrollCarousel itemClassName="w-64" ariaLabel="Popular strains">
              {strains.map((s) => (
                <StrainCard
                  key={s.slug}
                  s={{
                    slug: s.slug,
                    name: s.name,
                    type: s.type,
                    effects: s.effects ?? [],
                    thcLow: s.thc_low,
                    thcHigh: s.thc_high,
                  }}
                />
              ))}
            </ScrollCarousel>
          </section>
          </Reveal>
        )}

        {/* Popular products */}
        {popular && popular.length > 0 && (
          <Reveal>
          <section>
            <SectionHeading eyebrow="Trending" title="Popular products" href="/products" />
            <ScrollCarousel itemClassName="w-52" ariaLabel="Popular products">
              {popular.map((p) => {
                const disp = p.dispensary as { slug: string } | null;
                return (
                  <ProductCard
                    key={p.id}
                    p={{
                      name: p.name,
                      brand: p.brand,
                      priceCents: p.price_cents,
                      imageUrl: cardImageUrl(p),
                      categorySlug: p.category?.slug,
                      strainType: p.strain_type,
                      thcPercentage: p.thc_percentage,
                      inStock: p.in_stock,
                      rating: p.rating_avg,
                      reviewCount: p.rating_count,
                      productId: p.id,
                      dispensarySlug: disp?.slug,
                    }}
                  />
                );
              })}
            </ScrollCarousel>
          </section>
          </Reveal>
        )}

        {/* Learn rail (editorial content, Weedmaps pattern) */}
        <Reveal>
        <section>
          <SectionHeading eyebrow="Cannabis 101" title="New here? Start with the basics" href="/learn" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ARTICLES.slice(0, 4).map((a) => (
              <ArticleCard key={a.slug} a={a} />
            ))}
          </div>
        </section>
        </Reveal>

        {/* Geo directory, Weedmaps-style: a curated row of big markets up
            front, the full SEO link grid collapsed out of the visual flow. */}
        {regionEntries.length > 0 && (
          <Reveal>
          <section>
            <SectionHeading
              eyebrow="Shop your market"
              title="Popular destinations"
              href="/dispensaries"
            />
            {popularCities.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {popularCities.map((c) => (
                  <Link
                    key={`${c.state}-${c.city}`}
                    href={`/dispensaries/${c.state.toLowerCase()}/${citySlug(c.city)}`}
                    className="border-border bg-surface hover:border-primary/50 hover:text-primary inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors"
                  >
                    <MapPin className="text-muted h-3.5 w-3.5" />
                    {c.city}, {c.state}
                  </Link>
                ))}
              </div>
            )}
            {topStates.length > 0 && (
              <div className="text-muted mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                {topStates.map((r) => (
                  <Link
                    key={r.state}
                    href={`/dispensaries/${r.state.toLowerCase()}`}
                    className="hover:text-primary transition-colors"
                  >
                    {US_STATES[r.state] ?? r.state}
                    <span className="text-muted/60"> ({r.dispensaryCount.toLocaleString()})</span>
                  </Link>
                ))}
              </div>
            )}
            <details className="group mt-5">
              <summary className="text-primary inline-flex cursor-pointer list-none items-center gap-1 text-sm font-medium hover:underline">
                Browse all states and cities
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
              </summary>
              <div className="mt-5">
                <RegionGrid regions={regionEntries} />
              </div>
            </details>
          </section>
          </Reveal>
        )}
      </div>
    </main>
  );
}
