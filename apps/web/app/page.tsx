import Link from 'next/link';
import { ArrowRight, MapPin, ShoppingBag, Sparkles, Store, Tag, Truck } from 'lucide-react';
import { CategoryPills } from '@/components/category-pills';
import { DispensaryCard } from '@/components/dispensary-card';
import { HeroCarousel, type HeroSlide } from '@/components/home/hero-carousel';
import { ProductCard } from '@/components/product-card';
import { SearchBar } from '@/components/search-bar';
import { JsonLd } from '@/components/seo/json-ld';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CATALOG_IMAGE_EMBED, cardImageUrl } from '@/lib/catalog';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo';
import { createStaticClient } from '@/lib/supabase/static';

// Public, anon-only page — serve cached HTML and refresh every 5 min (ISR).
export const revalidate = 300;

const DISP_FIELDS =
  'slug,name,city,state,cover_image_url,logo_url,is_delivery,is_pickup,is_medical,is_recreational,rating_avg,rating_count,status';

function discountLabel(type: string, value: number): string {
  if (type === 'percentage') return `${value}% off`;
  if (type === 'fixed') return `$${value} off`;
  return 'BOGO';
}

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
    dispCount,
    prodCount,
    stateCountRes,
  ] = await Promise.all([
    supabase
      .from('dispensaries')
      .select(
        'slug,name,city,state,cover_image_url,logo_url,is_delivery,is_pickup,is_medical,is_recreational,featured,rating_avg,rating_count',
      )
      .eq('status', 'active')
      .order('featured', { ascending: false })
      .order('rating_count', { ascending: false })
      .limit(8),
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
      .limit(6),
    supabase
      .from('products')
      .select(
        `id,name,brand,price_cents,image_urls,strain_type,thc_percentage,in_stock,rating_avg,rating_count,dispensary:dispensaries!inner(slug,status), ${CATALOG_IMAGE_EMBED}`,
      )
      .eq('dispensary.status', 'active')
      .eq('in_stock', true)
      .order('rating_count', { ascending: false })
      .order('rating_avg', { ascending: false })
      .limit(10),
    supabase.from('dispensaries').select('id', head).eq('status', 'active'),
    supabase.from('products').select('id', head),
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

  const stateCount = stateCountRes.data ?? 0;
  const nf = new Intl.NumberFormat('en-US');
  const stats = [
    { label: 'Dispensaries', value: `${nf.format(dispCount.count ?? 0)}` },
    { label: 'Products', value: `${nf.format(prodCount.count ?? 0)}` },
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

      {/* Hero */}
      <section className="border-border/70 bg-hero-glow relative overflow-hidden border-b">
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:py-28">
          <span className="border-primary/20 bg-primary-muted text-primary inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            Find licensed dispensaries near you
          </span>
          <h1 className="animate-slide-up mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
            The Google Maps of <span className="gradient-text">cannabis</span>
          </h1>
          <p className="text-muted mx-auto mt-5 max-w-xl text-lg">
            Discover dispensaries, browse menus, read reviews, find deals, and order for pickup or
            delivery — all in one place.
          </p>
          <div className="mx-auto mt-8 max-w-2xl">
            <SearchBar size="lg" />
          </div>
          <div className="text-muted mt-10 flex items-center justify-center gap-8 text-sm">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-foreground text-2xl font-bold">{s.value}</p>
                <p className="text-xs uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Promoted hero banner carousel (paid hero placements) */}
      {heroSlides.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 pt-10">
          <HeroCarousel slides={heroSlides} />
        </div>
      )}

      <div className="mx-auto max-w-7xl space-y-16 px-4 py-16">
        {/* Browse by category */}
        <section>
          <SectionHeading eyebrow="Explore" title="Browse by category" />
          <CategoryPills categories={categories ?? []} />
        </section>

        {/* Featured dispensaries */}
        <section>
          <SectionHeading eyebrow="Top rated" title="Featured dispensaries" href="/dispensaries" />
          {featured && featured.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((d) => (
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
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="text-muted">No dispensaries yet. Check back soon.</p>
          )}
        </section>

        {/* Live deals */}
        {deals && deals.length > 0 && (
          <section>
            <SectionHeading eyebrow="Save today" title="Deals near you" href="/deals" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {deals.map((deal) => {
                const disp = deal.dispensary as {
                  slug: string;
                  name: string;
                  city: string;
                  state: string;
                } | null;
                return (
                  <Link
                    key={deal.id}
                    href={disp ? `/dispensary/${disp.slug}` : '/deals'}
                    className="rounded-card border-primary/25 bg-primary-subtle hover:border-primary/60 hover:shadow-card-hover group flex items-start justify-between gap-3 border p-5 transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <div className="min-w-0">
                      <Tag className="text-primary mb-2 h-4 w-4" />
                      <p className="text-primary font-semibold">{deal.title}</p>
                      {deal.description && (
                        <p className="text-muted mt-1 line-clamp-2 text-sm">{deal.description}</p>
                      )}
                      {disp && (
                        <p className="text-muted mt-2 text-xs">
                          {disp.name} · {disp.city}, {disp.state}
                        </p>
                      )}
                    </div>
                    <Badge tone="primary" className="shrink-0">
                      {discountLabel(deal.discount_type, deal.discount_value)}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Popular products */}
        {popular && popular.length > 0 && (
          <section>
            <SectionHeading eyebrow="Trending" title="Popular products" href="/products" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {popular.slice(0, 5).map((p) => {
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
            </div>
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
