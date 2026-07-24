import type { Metadata } from 'next';
import { Link } from 'next-view-transitions';
import { notFound } from 'next/navigation';
import { Sparkles, Store, Tag } from 'lucide-react';
import { deleteProductReview } from '@/app/actions/reviews';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ViewTracker } from '@/components/analytics/view-tracker';
import { RecordRecentlyViewed } from '@/components/recently-viewed';
import { AddToCart } from '@/components/cart/add-to-cart';
import { DeleteButton } from '@/components/dashboard/delete-button';
import { ProductGallery } from '@/components/product-gallery';
import { ProductCard, type ProductCardData } from '@/components/product-card';
import { DispensarySectionNav } from '@/components/dispensary/section-nav';
import { OpenNowChip } from '@/components/open-now-chip';
import { StickyCtaBar } from '@/components/sticky-cta-bar';
import { ProductReviewForm } from '@/components/product-review-form';
import { RatingStars } from '@/components/rating-stars';
import { JsonLd } from '@/components/seo/json-ld';
import { Badge } from '@/components/ui/badge';
import { clampTitle } from '@/lib/seo';
import { CATALOG_IMAGE_EMBED, cardImageUrl } from '@/lib/catalog';
import { dealBadge, formatPrice } from '@/lib/format';
import type { OperatingHours } from '@weedtip/shared';
import { getAuth } from '@/lib/auth';
import { getDispensaryTier, tierAtLeast } from '@/lib/plan';
import { SITE_URL } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

const STRAIN_LABEL: Record<string, string> = {
  indica: 'Indica',
  sativa: 'Sativa',
  hybrid: 'Hybrid',
  cbd: 'CBD',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('products')
    .select('name, brand, description, strain_type')
    .eq('id', id)
    .maybeSingle();
  if (!data) return { title: 'Product' };

  // Keep the full title (+ " · Weedtip" suffix) under Google's ~60-char cap:
  // prefer "name by brand" when it fits, else the name alone, truncated if the
  // product name itself is very long (Semrush "title too long").
  const withBrand = data.brand ? `${data.name} by ${data.brand}` : data.name;
  const title = withBrand.length <= 50 ? withBrand : clampTitle(data.name);
  const description =
    data.description?.slice(0, 160) ??
    `Buy ${data.name}${data.brand ? ` by ${data.brand}` : ''} — browse price, THC/CBD, reviews, and which dispensaries carry it on Weedtip.`;
  const canonical = `/product/${id}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', title, description, url: canonical },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS limits public reads to products of active dispensaries.
  const { data: product } = await supabase
    .from('products')
    .select(
      '*, dispensary:dispensaries(id,slug,name), strain:strains(slug,name,description,effects,flavors), brand:brands(slug,name), catalog:brand_products(image_url,description)',
    )
    .eq('id', id)
    .maybeSingle();
  if (!product) notFound();

  // Enrich a sparse listing from the brand's canonical catalog entry.
  const catalog = product.catalog as {
    image_url: string | null;
    description: string | null;
  } | null;
  const images =
    product.image_urls && product.image_urls.length > 0
      ? product.image_urls
      : catalog?.image_url
        ? [catalog.image_url]
        : [];
  const description = product.description ?? catalog?.description ?? null;

  const nowIso = new Date().toISOString();
  // Multi-retailer "where to buy": other active-shop listings of the SAME item.
  // A shared catalog_id is the strong signal, but scraped menus often lack one —
  // so also match this brand's identically-named SKU. Both run in parallel and
  // merge, so the compare list populates far more often than catalog_id alone.
  const siblingSelect =
    'id,price_cents,in_stock,dispensary:dispensaries!inner(slug,name,city,state,status,hours,timezone)';
  const siblingQueries = [];
  if (product.catalog_id) {
    siblingQueries.push(
      supabase
        .from('products')
        .select(siblingSelect)
        .eq('catalog_id', product.catalog_id)
        .neq('id', id)
        .eq('dispensary.status', 'active')
        .limit(12),
    );
  } else {
    // No shared catalog id (common for scraped menus) — match the identically
    // named SKU across shops. Exact (not fuzzy) so we never link unrelated items.
    siblingQueries.push(
      supabase
        .from('products')
        .select(siblingSelect)
        .ilike('name', product.name)
        .neq('id', id)
        .eq('dispensary.status', 'active')
        .limit(12),
    );
  }

  const [{ data: reviews }, { user }, { data: shopDeals }, siblingResults] = await Promise.all([
    supabase
      .from('product_reviews')
      .select('id,rating,body,created_at,author_name,user_id')
      .eq('product_id', id)
      .order('created_at', { ascending: false }),
    getAuth(),
    // "Save with these deals" — the selling shop's live offers.
    product.dispensary_id
      ? supabase
          .from('deals')
          .select('id,title,discount_type,discount_value,code')
          .eq('dispensary_id', product.dispensary_id)
          .eq('is_active', true)
          .lte('start_date', nowIso)
          .gte('end_date', nowIso)
          .order('end_date')
          .limit(3)
      : Promise.resolve({ data: [] }),
    siblingQueries.length ? Promise.all(siblingQueries) : Promise.resolve([]),
  ]);

  type SiblingRow = {
    id: string;
    price_cents: number;
    in_stock: boolean;
    dispensary: {
      slug: string;
      name: string;
      city: string | null;
      state: string;
      hours: OperatingHours | null;
      timezone: string | null;
    } | null;
  };
  // Merge + de-dupe the two match strategies; in-stock first, then cheapest.
  const siblingById = new Map<string, SiblingRow>();
  for (const res of siblingResults) {
    for (const row of (res.data as SiblingRow[] | null) ?? []) {
      if (!siblingById.has(row.id)) siblingById.set(row.id, row);
    }
  }
  const siblings = [...siblingById.values()]
    .sort((a, b) => Number(b.in_stock) - Number(a.in_stock) || a.price_cents - b.price_cents)
    .slice(0, 8);

  const dispensary = product.dispensary as { id: string; slug: string; name: string } | null;
  // Online ordering is a Basic-tier feature — free shops list their menu but
  // don't take orders through Weedtip.
  const ordersEnabled = dispensary
    ? tierAtLeast(await getDispensaryTier(dispensary.id), 'paid')
    : false;
  const strain = product.strain as {
    slug: string;
    name: string;
    description: string | null;
    effects: string[];
    flavors: string[];
  } | null;
  const brand = product.brand as { slug: string; name: string } | null;
  const myReview = user ? (reviews ?? []).find((r) => r.user_id === user.id) : undefined;

  // Related products — more from this brand, then same category as a fallback,
  // on active menus. Cross-sell that keeps discovery moving past the single SKU.
  type RelatedRow = {
    id: string;
    name: string;
    brand: string | null;
    price_cents: number;
    image_urls: string[] | null;
    strain_type: string | null;
    thc_percentage: number | null;
    in_stock: boolean;
    rating_avg: number;
    rating_count: number;
    dispensary: { slug: string; status: string } | null;
    catalog: { id: string; image_url: string | null } | null;
  };
  const relSelect = `id,name,brand,price_cents,image_urls,strain_type,thc_percentage,in_stock,rating_avg,rating_count,dispensary:dispensaries!inner(slug,status), ${CATALOG_IMAGE_EMBED}`;
  const notInList = (ids: string[]) => `(${ids.join(',')})`;
  let related: RelatedRow[] = [];
  const excludeIds = [id, ...siblings.map((s) => s.id)];
  if (product.brand_id) {
    const { data } = await supabase
      .from('products')
      .select(relSelect)
      .eq('brand_id', product.brand_id)
      .eq('dispensary.status', 'active')
      .not('id', 'in', notInList(excludeIds))
      .limit(16);
    related = (data as unknown as RelatedRow[] | null) ?? [];
  }
  if (related.length < 4 && product.category_id) {
    const seen = [...excludeIds, ...related.map((r) => r.id)];
    const { data } = await supabase
      .from('products')
      .select(relSelect)
      .eq('category_id', product.category_id)
      .eq('dispensary.status', 'active')
      .not('id', 'in', notInList(seen))
      .limit(16);
    related = [...related, ...((data as unknown as RelatedRow[] | null) ?? [])];
  }
  // De-dupe, prefer in-stock then better-rated, cap the rail.
  const relById = new Map<string, RelatedRow>();
  for (const r of related) if (!relById.has(r.id)) relById.set(r.id, r);
  related = [...relById.values()]
    .sort(
      (a, b) =>
        Number(b.in_stock) - Number(a.in_stock) ||
        b.rating_avg - a.rating_avg ||
        b.rating_count - a.rating_count,
    )
    .slice(0, 8);

  // Active auto-apply storefront sale → the price shown and charged.
  const { data: eff } = await supabase.rpc('effective_unit_price', { p_product_id: id });
  const effRow = eff?.[0];
  const onSale = !!effRow?.deal_id && effRow.unit_cents < product.price_cents;
  const priceCents = onSale ? effRow!.unit_cents : product.price_cents;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    ...(description ? { description } : {}),
    ...(brand?.name || product.brand
      ? { brand: { '@type': 'Brand', name: brand?.name ?? product.brand } }
      : {}),
    // Google's merchant-listing rich result requires an image; Product+offers
    // without one is invalid markup, so imageless listings stay a plain
    // Product node until they get a photo.
    ...(images[0]
      ? {
          image: images[0],
          offers: {
            '@type': 'Offer',
            price: (priceCents / 100).toFixed(2),
            priceCurrency: 'USD',
            availability: product.in_stock
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
            url: `${SITE_URL}/product/${product.id}`,
            ...(dispensary ? { seller: { '@type': 'Organization', name: dispensary.name } } : {}),
          },
        }
      : {}),
    ...(product.rating_count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Number(product.rating_avg.toFixed(1)),
            reviewCount: product.rating_count,
          },
        }
      : {}),
    ...(reviews && reviews.length > 0
      ? {
          review: reviews.slice(0, 10).map((r) => ({
            '@type': 'Review',
            reviewRating: {
              '@type': 'Rating',
              ratingValue: r.rating,
              bestRating: 5,
              worstRating: 1,
            },
            author: { '@type': 'Person', name: r.author_name ?? 'Weedtip member' },
            datePublished: new Date(r.created_at).toISOString().slice(0, 10),
            ...(r.body ? { reviewBody: r.body } : {}),
          })),
        }
      : {}),
  };

  // A Product node is only valid with at least one of offers / aggregateRating
  // / review (Google + SEMrush both reject a bare Product). Imageless,
  // unreviewed products would emit an invalid node — skip the markup for them
  // rather than ship structured-data errors.
  const productSchemaValid =
    'offers' in jsonLd || 'aggregateRating' in jsonLd || 'review' in jsonLd;

  const crumbs = [
    { name: 'Home', href: '/' },
    { name: 'Products', href: '/products' },
    { name: product.name, href: `/product/${product.id}` },
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {productSchemaValid && <JsonLd data={jsonLd} />}
      <ViewTracker
        event="product_viewed"
        properties={{
          product_id: product.id,
          name: product.name,
          brand: brand?.name ?? product.brand ?? null,
          price_cents: priceCents,
          in_stock: product.in_stock,
          dispensary_id: dispensary?.id ?? null,
        }}
      />
      <RecordRecentlyViewed
        item={{
          kind: 'product',
          href: `/product/${product.id}`,
          name: product.name,
          image: images[0] ?? null,
          sub: brand?.name ?? product.brand ?? null,
        }}
      />
      <Breadcrumbs items={crumbs} />
      <div className="grid gap-8 sm:grid-cols-2">
        <ProductGallery images={images} alt={product.name} />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {product.strain_type && (
              <Badge tone="primary">{STRAIN_LABEL[product.strain_type]}</Badge>
            )}
            {!product.in_stock && <Badge tone="muted">Out of stock</Badge>}
          </div>
          {(brand || product.brand) && (
            <p className="text-muted mt-3 text-sm">
              {brand ? (
                <Link href={`/brand/${brand.slug}`} className="hover:text-primary">
                  {brand.name}
                </Link>
              ) : (
                product.brand
              )}
            </p>
          )}
          <h1 className="mt-1 text-3xl font-bold">{product.name}</h1>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-primary text-2xl font-semibold">{formatPrice(priceCents)}</span>
            {onSale && (
              <>
                <span className="text-muted text-lg line-through">
                  {formatPrice(product.price_cents)}
                </span>
                <Badge tone="primary">Sale</Badge>
              </>
            )}
            {product.unit && <span className="text-muted text-sm">/ {product.unit}</span>}
          </p>

          {product.rating_count > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <RatingStars rating={product.rating_avg} />
              <span className="text-muted text-sm">
                {product.rating_avg.toFixed(1)} ({product.rating_count})
              </span>
            </div>
          )}

          <div className="text-muted mt-3 flex flex-wrap gap-3 text-sm">
            {product.thc_percentage != null && <span>{product.thc_percentage}% THC</span>}
            {product.cbd_percentage != null && <span>{product.cbd_percentage}% CBD</span>}
            {strain && (
              <Link href={`/strain/${strain.slug}`} className="text-primary hover:underline">
                {strain.name} strain
              </Link>
            )}
          </div>

          {dispensary && (
            <Link
              href={`/dispensary/${dispensary.slug}`}
              className="text-muted hover:text-foreground mt-4 inline-flex items-center gap-1.5 text-sm"
            >
              <Store className="h-4 w-4" /> Sold at {dispensary.name}
            </Link>
          )}

          {product.in_stock && dispensary && ordersEnabled && (
            <div id="add" className="mt-5 max-w-sm scroll-mt-24">
              <AddToCart
                showQuantity
                dispensary={{ id: dispensary.id, slug: dispensary.slug, name: dispensary.name }}
                product={{
                  productId: product.id,
                  name: product.name,
                  priceCents,
                }}
              />
            </div>
          )}

          {/* Shops that don't take orders online still show the product + price;
              we just point the shopper at the store instead of a dead cart. */}
          {product.in_stock && dispensary && !ordersEnabled && (
            <p className="text-muted mt-5 max-w-sm text-sm">
              This shop doesn’t take orders through Weedtip yet — contact them directly to buy.{' '}
              <Link
                href={`/dispensary/${dispensary.slug}`}
                className="text-primary font-medium hover:underline"
              >
                View store info &amp; hours →
              </Link>
            </p>
          )}

          {shopDeals && shopDeals.length > 0 && dispensary && (
            <div className="border-primary/25 bg-primary-subtle mt-5 rounded-lg border p-3">
              <p className="text-primary flex items-center gap-1.5 text-sm font-semibold">
                <Tag className="h-4 w-4" /> Save with these deals
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {shopDeals.map((dl) => (
                  <li key={dl.id} className="flex items-center justify-between gap-2">
                    <span className="text-muted truncate">{dl.title}</span>
                    <Badge tone="primary" className="shrink-0">
                      {dealBadge(dl.discount_type, dl.discount_value)}
                    </Badge>
                  </li>
                ))}
              </ul>
              <Link
                href={`/dispensary/${dispensary.slug}#deals`}
                className="text-primary -mb-2 mt-2 inline-block pb-2 pt-2 text-xs font-medium hover:underline"
              >
                All deals at {dispensary.name} →
              </Link>
            </div>
          )}
        </div>
      </div>

      <DispensarySectionNav
        sections={[
          ...(description ? [{ id: 'description', label: 'Description' }] : []),
          ...(strain &&
          (strain.effects.length > 0 || strain.flavors.length > 0 || strain.description)
            ? [{ id: 'strain', label: 'Strain' }]
            : []),
          ...(siblings.length > 0 ? [{ id: 'stores', label: 'Where to buy' }] : []),
          { id: 'reviews', label: 'Reviews' },
          ...(related.length > 0 ? [{ id: 'related', label: 'Related' }] : []),
        ]}
      />

      {description && (
        <section id="description" className="mt-8 scroll-mt-24">
          <h2 className="mb-2 text-lg font-semibold">Description</h2>
          <p className="text-muted">{description}</p>
        </section>
      )}

      {strain && (strain.effects.length > 0 || strain.flavors.length > 0 || strain.description) && (
        <section id="strain" className="mt-8 scroll-mt-24">
          <h2 className="mb-2 text-lg font-semibold">About this strain: {strain.name}</h2>
          {strain.description && (
            <p className="text-muted line-clamp-4 text-sm leading-relaxed">{strain.description}</p>
          )}
          {strain.effects.length > 0 && (
            <div className="mt-3">
              <p className="text-muted mb-1.5 text-xs font-semibold uppercase tracking-wide">
                Top reported effects
              </p>
              <div className="flex flex-wrap gap-2">
                {strain.effects.slice(0, 8).map((e) => (
                  <span
                    key={e}
                    className="border-primary/30 bg-primary-muted text-primary inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium capitalize"
                  >
                    <Sparkles className="h-3 w-3" /> {e}
                  </span>
                ))}
              </div>
            </div>
          )}
          {strain.flavors.length > 0 && (
            <div className="mt-3">
              <p className="text-muted mb-1.5 text-xs font-semibold uppercase tracking-wide">
                Top reported flavors
              </p>
              <div className="flex flex-wrap gap-2">
                {strain.flavors.slice(0, 8).map((f) => (
                  <span
                    key={f}
                    className="border-warning/30 text-warning inline-flex items-center rounded-full border bg-amber-500/10 px-3 py-1 text-xs font-medium capitalize"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
          <Link
            href={`/strain/${strain.slug}`}
            className="text-primary mt-3 inline-block text-sm font-medium hover:underline"
          >
            Full strain profile →
          </Link>
        </section>
      )}

      {siblings.length > 0 && (
        <section id="stores" className="mt-8 scroll-mt-24">
          <h2 className="mb-1 text-lg font-semibold">Where to buy</h2>
          <p className="text-muted mb-3 text-sm">
            {siblings.length + 1} shops carry this — compare price and open hours.
          </p>
          <div className="rounded-card border-border bg-surface divide-border divide-y overflow-hidden border">
            {siblings.map((sib) => {
              const shop = sib.dispensary;
              // A malformed join row would render a blank-but-clickable row.
              if (!shop?.name || !shop.state) return null;
              const cheaper = sib.price_cents < product.price_cents;
              return (
                <Link
                  key={sib.id}
                  href={`/product/${sib.id}`}
                  className="hover:bg-surface-2 flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors"
                >
                  <span className="min-w-0">
                    <span className="text-foreground block truncate font-medium">{shop.name}</span>
                    <span className="text-muted mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span>{shop.city ? `${shop.city}, ${shop.state}` : shop.state}</span>
                      <OpenNowChip hours={shop.hours} timezone={shop.timezone} />
                      {!sib.in_stock && <span className="text-muted">Out of stock</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={cheaper ? 'text-primary font-semibold' : 'font-semibold'}>
                      {formatPrice(sib.price_cents)}
                    </span>
                    {cheaper && <span className="text-primary block text-xs">Lower price</span>}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section id="reviews" className="mt-10 scroll-mt-24">
        <h2 className="mb-3 text-lg font-semibold">
          Reviews{reviews && reviews.length > 0 ? ` (${reviews.length})` : ''}
        </h2>
        {user ? (
          <div className="rounded-card border-border bg-surface mb-6 border p-4">
            <p className="mb-3 text-sm font-medium">
              {myReview ? 'Edit your review' : 'Review this product'}
            </p>
            <ProductReviewForm
              productId={product.id}
              initialRating={myReview?.rating ?? 0}
              initialBody={myReview?.body ?? ''}
            />
          </div>
        ) : (
          <p className="text-muted mb-6 text-sm">
            <Link href="/sign-in" className="text-primary hover:underline">
              Sign in
            </Link>{' '}
            to review this product.
          </p>
        )}

        {reviews && reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-card border-border bg-surface border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <RatingStars rating={r.rating} />
                    <span className="text-sm font-medium">{r.author_name ?? 'Weedtip member'}</span>
                  </div>
                  <span className="text-muted text-xs">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                {r.body && <p className="text-muted mt-2 text-sm">{r.body}</p>}
                {user && r.user_id === user.id && (
                  <div className="mt-2 flex items-center gap-2">
                    <Badge tone="muted">Your review</Badge>
                    <DeleteButton
                      action={deleteProductReview.bind(null, r.id, product.id)}
                      label="Delete"
                      confirmText="Delete your review? This cannot be undone."
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-card border-border bg-surface text-muted border border-dashed p-6 text-center text-sm">
            <p className="text-foreground font-medium">No reviews yet</p>
            <p className="mt-1">
              {user ? 'Be the first to review this product.' : 'Sign in above to be the first.'}
            </p>
          </div>
        )}
      </section>

      {related.length > 0 && (
        <section id="related" className="mt-10 scroll-mt-24">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {brand?.name ? `More from ${brand.name}` : 'Related products'}
            </h2>
            {brand?.slug && (
              <Link
                href={`/brand/${brand.slug}`}
                className="text-primary shrink-0 text-sm font-medium hover:underline"
              >
                View all →
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((r) => (
              <ProductCard
                key={r.id}
                p={{
                  name: r.name,
                  brand: r.brand,
                  priceCents: r.price_cents,
                  imageUrl: cardImageUrl(r),
                  strainType: r.strain_type as ProductCardData['strainType'],
                  thcPercentage: r.thc_percentage,
                  inStock: r.in_stock,
                  rating: r.rating_avg,
                  reviewCount: r.rating_count,
                  productId: r.id,
                  dispensarySlug: r.dispensary?.slug,
                }}
              />
            ))}
          </div>
        </section>
      )}

      {product.in_stock && dispensary && ordersEnabled ? (
        <>
          <div aria-hidden className="h-20 lg:hidden" />
          <StickyCtaBar href="#add" label="Add to bag" />
        </>
      ) : siblings.length > 0 ? (
        <>
          <div aria-hidden className="h-20 lg:hidden" />
          <StickyCtaBar href="#stores" label="Where to buy" />
        </>
      ) : null}
    </main>
  );
}
