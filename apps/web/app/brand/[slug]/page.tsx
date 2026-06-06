import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { BrandFollowButton } from '@/components/brand/brand-follow-button';
import { ClaimBrandButton } from '@/components/brand/claim-brand-button';
import { ProductCard } from '@/components/product-card';
import { getAuth } from '@/lib/auth';
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

  const { user, profile } = await getAuth();
  const canClaim =
    !!user &&
    !brand.owner_id &&
    (profile?.role === 'dispensary_owner' || profile?.role === 'admin');

  const { data: products } = await supabase
    .from('products')
    .select('*, dispensary:dispensaries!inner(slug,name,status)')
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
        {brand.logo_url ? (
          <img
            src={brand.logo_url}
            alt={brand.name}
            className="bg-surface-2 border-border h-16 w-16 shrink-0 rounded-2xl border object-contain p-1"
          />
        ) : (
          <span className="bg-primary-muted text-primary ring-primary/20 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold ring-1">
            {brand.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-1">Brand</p>
          <h1 className="text-2xl font-bold sm:text-3xl">{brand.name}</h1>
          {brand.description && (
            <p className="text-muted mt-2 max-w-2xl text-sm">{brand.description}</p>
          )}
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
          <Stat value={String(list.length)} label="Products" />
          <Stat value={String(shops.size)} label="Shops" />
          <Stat value={avgRating} label="Avg rating" />
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
                  <img src={it.image_url} alt={it.name} className="bg-surface-2 h-32 w-full object-cover" />
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
        <h2 className="mb-3 text-lg font-semibold">Products</h2>
        {list.length === 0 ? (
          <p className="text-muted">No products from this brand are listed yet.</p>
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
                    imageUrl: p.image_urls[0] ?? null,
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
    </main>
  );
}
