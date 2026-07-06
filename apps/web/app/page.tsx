import Link from 'next/link';
import { ArrowRight, MapPin, ShoppingBag, Sparkles, Store, Truck } from 'lucide-react';
import type { OperatingHours } from '@weedtip/shared';
import { CategoryTiles } from '@/components/home/category-tiles';
import { HeroCarousel, type HeroSlide } from '@/components/home/hero-carousel';
import { MarketFeed, type FeedDeal, type FeedShop } from '@/components/home/market-feed';
import { RegionGrid, type RegionEntry } from '@/components/home/region-grid';
import { ScrollCarousel } from '@/components/home/scroll-carousel';
import { DispensaryCard } from '@/components/dispensary-card';
import { LogoImage } from '@/components/logo-image';
import { ProductCard } from '@/components/product-card';
import { SearchBar } from '@/components/search-bar';
import { JsonLd } from '@/components/seo/json-ld';
import { Button } from '@/components/ui/button';
import { CATALOG_IMAGE_EMBED, cardImageUrl } from '@/lib/catalog';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo';
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
  const head = { count: 'exact' as const, head: true };

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
    dispCount,
    prodCount,
    lineupCount,
    stateCountRes,
  ] = await Promise.all([
    supabase
      .from('dispensaries')
      .select(
        'slug,name,city,state,cover_image_url,logo_url,is_delivery,is_pickup,is_medical,is_recreational,featured,rating_avg,rating_count,hours,timezone',
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
        `id,name,brand,price_cents,image_urls,strain_type,thc_percentage,in_stock,rating_avg,rating_count,dispensary:dispensaries!inner(slug,status), ${CATALOG_IMAGE_EMBED}`,
      )
      .eq('dispensary.status', 'active')
      .eq('in_stock', true)
      .order('rating_count', { ascending: false })
      .order('rating_avg', { ascending: false })
      .limit(12),
    supabase.from('brands').select('id,slug,name,logo_url').order('name'),
    supabase.from('brand_products').select('brand_id'),
    supabase
      .from('dispensaries')
      .select(
        'slug,name,city,state,cover_image_url,logo_url,is_delivery,is_pickup,is_medical,is_recreational,featured,rating_avg,rating_count,hours,timezone',
      )
      .eq('status', 'active')
      .eq('is_delivery', true)
      .order('rating_count', { ascending: false })
      .limit(12),
    supabase.rpc('region_directory', { top_cities_limit: 5 }),
    supabase.from('dispensaries').select('id', head).eq('status', 'active'),
    supabase.from('products').select('id', head),
    supabase.from('brand_products').select('id', head),
    supabase.rpc('get_active_dispensary_state_count'),
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
  const topBrands = (brands ?? [])
    .map((b) => ({ ...b, products: lineupByBrand.get(b.id) ?? 0 }))
    .filter((b) => b.products > 0)
    .sort((a, b) => b.products - a.products)
    .slice(0, 14);

  const regionEntries: RegionEntry[] = (regions ?? []).map((r) => ({
    state: r.state,
    dispensaryCount: r.dispensary_count,
    topCities: (r.top_cities as { city: string; count: number }[] | null) ?? [],
  }));

  const stateCount = stateCountRes.data ?? 0;
  const nf = new Intl.NumberFormat('en-US');
  const stats = [
    { label: 'Dispensaries', value: `${nf.format(dispCount.count ?? 0)}` },
    // Menu items plus official brand-catalog products — the real breadth of what
    // a shopper can browse (a raw menu count under-sold the platform badly).
    { label: 'Products', value: `${nf.format((prodCount.count ?? 0) + (lineupCount.count ?? 0))}` },
    { label: 'States', value: `${stateCount}` },
  ];

  const steps = [
    { icon: MapPin, title: 'Find shops near you', body: 'Search licensed dispensaries by location, then filter by pickup, delivery, and more.' },
    { icon: ShoppingBag, title: 'Browse live menus', body: 'Compare real-time prices, deals, THC/CBD, brands, and verified reviews.' },
    { icon: Truck, title: 'Order pickup or delivery', body: 'Check out in a few taps and pick up in-store or get it delivered.' },
  ];

  return (
    <main>
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={websiteJsonLd()} />

      {/* Promo hero carousel FIRST (Weedmaps order) — this is the money-making
          merchandising surface dispensaries and brands buy into. */}
      {heroSlides.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 pt-6">
          <HeroCarousel slides={heroSlides} />
        </div>
      )}

      {/* Search band + stat strip */}
      <section className="border-border/70 bg-hero-glow relative overflow-hidden border-b">
        <div className="relative mx-auto max-w-3xl px-4 py-12 text-center sm:py-16">
          <span className="border-primary/20 bg-primary-muted text-primary inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            Find licensed dispensaries near you
          </span>
          <h1 className="animate-slide-up mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
            The Google Maps of <span className="gradient-text">cannabis</span>
          </h1>
          <p className="text-muted mx-auto mt-4 max-w-xl text-lg">
            Discover dispensaries, browse menus, read reviews, find deals, and order for pickup or
            delivery — all in one place.
          </p>
          <div className="mx-auto mt-7 max-w-2xl">
            <SearchBar size="lg" />
          </div>
          <div className="text-muted mt-8 flex items-center justify-center gap-8 text-sm">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-foreground text-2xl font-bold">{s.value}</p>
                <p className="text-xs uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-16 px-4 py-16">
        {/* Shop by category */}
        <section>
          <SectionHeading eyebrow="Explore" title="Shop by category" href="/products" />
          <CategoryTiles categories={categories ?? []} />
        </section>

        {/* Featured brands */}
        {topBrands.length > 0 && (
          <section>
            <SectionHeading eyebrow="Official lineups" title="Featured brands" href="/brands" />
            <ScrollCarousel itemClassName="w-44" ariaLabel="Popular brands">
              {topBrands.map((b) => (
                <Link
                  key={b.slug}
                  href={`/brand/${b.slug}`}
                  className="card card-interactive flex h-full flex-col items-center gap-3 p-5 text-center"
                >
                  <LogoImage src={b.logo_url} name={b.name} className="h-14 w-14" />
                  <span className="line-clamp-2 text-sm font-semibold leading-tight">
                    {b.name}
                  </span>
                  <span className="text-muted text-xs">{b.products} products</span>
                </Link>
              ))}
            </ScrollCarousel>
          </section>
        )}

        {/* Delivery services */}
        {deliveryShops && deliveryShops.length > 0 && (
          <section>
            <SectionHeading eyebrow="To your door" title="Delivery services" href="/deliveries" />
            <ScrollCarousel itemClassName="w-72" ariaLabel="Delivery services">
              {deliveryShops.map((d) => (
                <DispensaryCard
                  key={d.slug}
                  d={{
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
                  }}
                />
              ))}
            </ScrollCarousel>
          </section>
        )}

        {/* Location-aware: dispensary storefronts + deals in the visitor's market */}
        <MarketFeed initialShops={initialShops} initialDeals={initialDeals} />

        {/* Popular products */}
        {popular && popular.length > 0 && (
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
        )}

        {/* Promo banner pair (Weedmaps-style paired merchandising banners) */}
        <section className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/advertise"
            className="rounded-card border-primary/30 bg-hero-glow group relative overflow-hidden border p-6 transition-all duration-200 hover:-translate-y-0.5"
          >
            <p className="eyebrow">For dispensaries &amp; brands</p>
            <h3 className="mt-1 text-lg font-bold">Own your neighborhood</h3>
            <p className="text-muted mt-1 text-sm">
              One exclusive sponsor, three featured spots, ten premium listings per region — at
              launch pricing.
            </p>
            <span className="text-primary mt-3 inline-flex items-center gap-1 text-sm font-semibold">
              See regions <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
          <Link
            href="/deals"
            className="rounded-card border-warning/30 group relative overflow-hidden border bg-gradient-to-br from-amber-500/10 to-transparent p-6 transition-all duration-200 hover:-translate-y-0.5"
          >
            <p className="eyebrow">Save on every order</p>
            <h3 className="mt-1 text-lg font-bold">Today&apos;s best deals near you</h3>
            <p className="text-muted mt-1 text-sm">
              BOGOs, first-visit discounts, and daily specials from licensed shops in your market.
            </p>
            <span className="text-warning mt-3 inline-flex items-center gap-1 text-sm font-semibold">
              Browse deals <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </section>

        {/* Region / city directory (SEO link grid) */}
        {regionEntries.length > 0 && (
          <section>
            <SectionHeading
              eyebrow="Every market"
              title="Find dispensaries by state"
              href="/dispensaries"
            />
            <RegionGrid regions={regionEntries} />
          </section>
        )}

        {/* How it works */}
        <section>
          <SectionHeading eyebrow="How it works" title="Order in three steps" />
          <div className="grid gap-5 sm:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.title} className="card sheen relative p-6">
                <span className="bg-primary-muted text-primary ring-primary/20 flex h-11 w-11 items-center justify-center rounded-xl ring-1">
                  <s.icon className="h-5 w-5" />
                </span>
                <p className="text-muted mt-4 text-xs font-semibold">STEP {i + 1}</p>
                <h3 className="mt-1 font-semibold">{s.title}</h3>
                <p className="text-muted mt-1.5 text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Owner CTA */}
        <section className="rounded-2xl border-primary/20 bg-hero-glow relative overflow-hidden border p-8 text-center sm:p-14">
          <span className="bg-primary-muted text-primary ring-primary/20 mx-auto flex h-12 w-12 items-center justify-center rounded-xl ring-1">
            <Store className="h-6 w-6" />
          </span>
          <h2 className="mt-5 text-2xl font-bold sm:text-3xl">Own a dispensary?</h2>
          <p className="text-muted mx-auto mt-2 max-w-md">
            List your shop on Weedtip, manage your menu and deals, run promotions, and reach
            customers searching nearby.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/sign-up">
              <Button size="lg">List your dispensary</Button>
            </Link>
            <Link href="/dispensaries">
              <Button variant="outline" size="lg">
                Explore the marketplace
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
