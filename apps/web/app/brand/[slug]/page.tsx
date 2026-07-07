import type { Metadata } from 'next';
import { Link } from 'next-view-transitions';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { BrandFollowButton } from '@/components/brand/brand-follow-button';
import { ClaimBrandButton } from '@/components/brand/claim-brand-button';
import { LogoImage } from '@/components/logo-image';
import { ProductCard } from '@/components/product-card';
import { getAuth } from '@/lib/auth';
import { CATALOG_IMAGE_EMBED, cardImageUrl, catalogImageSrc } from '@/lib/catalog';
import { pageSeo } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('brands')
    .select('name,description')
    .eq('slug', slug)
    .maybeSingle();
  if (!data) return { title: 'Brand' };
  const title = data.name;
  const description =
    data.description?.slice(0, 160) ??
    `Shop ${data.name} cannabis products and find which dispensaries carry them, with prices and reviews, on Weedtip.`;
  return pageSeo({ title, description, path: `/brand/${slug}` });
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-xl font-bold tracking-tight">{value}</p>
      <p className="text-muted text-xs uppercase tracking-wide">{label}</p>
    </div>
  );
}

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: brand } = await supabase.from('brands').select('*').eq('slug', slug).maybeSingle();
  if (!brand) notFound();

  const { user } = await getAuth();
  // Brand ownership is orthogonal to the role enum — any signed-in user can own
  // a brand (RLS gates the actual claim), so don't restrict the CTA by role.
  const canClaim = !!user && !brand.owner_id;

  const { data: products } = await supabase
    .from('products')
    .select(`*, dispensary:dispensaries!inner(slug,name,status), ${CATALOG_IMAGE_EMBED}`)
    .eq('brand_id', brand.id)
    .eq('dispensary.status', 'active')
    .order('price_cents');

  const list = products ?? [];

  // Active storefront sale prices for the brand's products.
  const saleMap = new Map<string, number>();
  if (list.length) {
    const { data: sales } = await supabase.rpc('sale_prices_for', {
      p_product_ids: list.map((p) => p.id),
    });
    for (const s of sales ?? []) saleMap.set(s.product_id, s.sale_cents);
  }

  // Stats + which shops carry the brand.
  const shops = new Map<string, string>();
  let ratingSum = 0;
  let ratingN = 0;
  for (const p of list) {
    const d = p.dispensary as { slug: string; name: string } | null;
    if (d) shops.set(d.slug, d.name);
    if (p.rating_count > 0) {
      ratingSum += p.rating_avg;
      ratingN += 1;
    }
  }
  const avgRating = ratingN > 0 ? (ratingSum / ratingN).toFixed(1) : '—';

  // Follow state + live updates for followers.
  let isFollowing = false;
  if (user) {
    const { data: f } = await supabase
      .from('brand_followers')
      .select('brand_id')
      .eq('user_id', user.id)
      .eq('brand_id', brand.id)
      .maybeSingle();
    isFollowing = !!f;
  }
  const { data: brandUpdates } = await supabase
    .from('brand_updates')
    .select('id,title,body,created_at')
    .eq('brand_id', brand.id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(10);

  // The brand's official catalog lineup.
  const { data: lineup } = await supabase
    .from('brand_products')
    .select('id,name,strain_type,thc_percentage,cbd_percentage,description,image_url')
    .eq('brand_id', brand.id)
    .order('sort_order')
    .order('name');

  // Adaptive stat strip: catalog size always; store metrics only once real
  // menus carry the brand (a '0 in stores / — rating' row reads as broken).
  const stats: { value: string; label: string }[] = [
    { value: String(lineup?.length ?? 0), label: 'Products' },
  ];
  if (list.length > 0) stats.push({ value: String(list.length), label: 'In stores' });
  if (shops.size > 0) stats.push({ value: String(shops.size), label: 'Shops' });
  if (ratingN > 0) stats.push({ value: avgRating, label: 'Avg rating' });

  // Related brands (biggest official lineups) keep discovery moving when this
  // brand has no store inventory yet.
  const { data: lineupSizes } = await supabase.from('brand_products').select('brand_id');
  const sizeByBrand = new Map<string, number>();
  for (const r of lineupSizes ?? []) {
    if (r.brand_id) sizeByBrand.set(r.brand_id, (sizeByBrand.get(r.brand_id) ?? 0) + 1);
  }
  const { data: allBrands } = await supabase
    .from('brands')
    .select('id,slug,name,logo_url')
    .neq('id', brand.id);
  const relatedBrands = (allBrands ?? [])
    .map((b) => ({ ...b, products: sizeByBrand.get(b.id) ?? 0 }))
    .filter((b) => b.products > 0)
    .sort((a, b) => b.products - a.products)
    .slice(0, 8);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Brands', href: '/brands' },
          { name: brand.name, href: `/brand/${brand.slug}` },
        ]}
      />

      <div className="card sheen mt-4 flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <LogoImage
          src={brand.logo_url}
          name={brand.name}
          className="h-16 w-16"
          rounded="rounded-2xl"
          textClassName="text-2xl"
          hideWhenEmpty={false}
        />
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-1">Brand</p>
          <h1 className="text-2xl font-bold sm:text-3xl">{brand.name}</h1>
          <p className="text-muted mt-2 max-w-2xl text-sm">
            {brand.description ??
              `Official ${brand.name} lineup — ${lineup?.length ?? 0} product${(lineup?.length ?? 0) === 1 ? '' : 's'} on Weedtip. Follow the brand to catch new drops and find shops that carry it.`}
          </p>
          {brand.website && (
            <a
              href={brand.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary mt-2 inline-block text-sm hover:underline"
            >
              Visit website →
            </a>
          )}
          {(user || canClaim) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {user && (
                <BrandFollowButton brandId={brand.id} slug={brand.slug} isFollowing={isFollowing} />
              )}
              {canClaim && <ClaimBrandButton brandId={brand.id} />}
            </div>
          )}
        </div>
        <div className="flex gap-6 sm:flex-col sm:gap-3">
          {stats.map((s) => (
            <Stat key={s.label} value={s.value} label={s.label} />
          ))}
        </div>
      </div>

      {brandUpdates && brandUpdates.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Latest updates</h2>
          <div className="space-y-3">
            {brandUpdates.map((u) => (
              <div key={u.id} className="rounded-card border-border bg-surface border p-4">
                <p className="font-medium">{u.title}</p>
                {u.body && <p className="text-muted mt-1 text-sm">{u.body}</p>}
                <p className="text-muted mt-1 text-xs">
                  {new Date(u.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {lineup && lineup.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Official lineup</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {lineup.map((it) => (
              <div key={it.id} className="rounded-card border-border bg-surface overflow-hidden border">
                {it.image_url ? (
                  <img src={catalogImageSrc(it.id, it.image_url) ?? undefined} alt={it.name} className="bg-surface-2 h-32 w-full object-cover" />
                ) : (
                  <div className="bg-surface-2 flex h-32 w-full items-center justify-center text-3xl font-bold text-muted">
                    {it.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="p-3">
                  <p className="truncate text-sm font-medium">{it.name}</p>
                  <p className="text-muted mt-0.5 text-xs capitalize">
                    {it.strain_type ?? ''}
                    {it.thc_percentage != null ? `${it.strain_type ? ' · ' : ''}${it.thc_percentage}% THC` : ''}
                  </p>
                  {it.description && (
                    <p className="text-muted mt-1 line-clamp-2 text-xs">{it.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {shops.size > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Carried at</h2>
          <div className="flex flex-wrap gap-2">
            {[...shops.entries()].map(([s, name]) => (
              <Link
                key={s}
                href={`/dispensary/${s}`}
                className="border-border bg-surface hover:border-primary/50 rounded-full border px-3 py-1.5 text-sm transition-colors"
              >
                {name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Available at dispensaries</h2>
        {list.length === 0 ? (
          <div className="rounded-card border-border bg-surface flex flex-wrap items-center justify-between gap-3 border p-5">
            <p className="text-muted text-sm">
              No live menus list {brand.name} yet — ask for it at your local shop, or follow the
              brand to hear when it lands.
            </p>
            <Link
              href="/dispensaries"
              className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
            >
              Find shops near you
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {list.map((p) => {
              const dispensary = p.dispensary as { slug: string; name: string } | null;
              return (
                <ProductCard
                  key={p.id}
                  p={{
                    name: p.name,
                    brand: brand.name,
                    priceCents: saleMap.get(p.id) ?? p.price_cents,
                    originalPriceCents: saleMap.has(p.id) ? p.price_cents : null,
                    imageUrl: cardImageUrl(p),
                    strainType: p.strain_type,
                    thcPercentage: p.thc_percentage,
                    inStock: p.in_stock,
                    rating: p.rating_avg,
                    reviewCount: p.rating_count,
                    productId: p.id,
                    dispensarySlug: dispensary?.slug,
                  }}
                />
              );
            })}
          </div>
        )}
      </section>

      {relatedBrands.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">More brands to explore</h2>
            <Link href="/brands" className="text-primary shrink-0 text-sm font-medium hover:underline">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {relatedBrands.map((b) => (
              <Link
                key={b.slug}
                href={`/brand/${b.slug}`}
                className="card card-interactive flex items-center gap-3 p-4"
              >
                <LogoImage src={b.logo_url} name={b.name} className="h-10 w-10 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{b.name}</span>
                  <span className="text-muted block text-xs">{b.products} products</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
