import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ProductCard } from '@/components/product-card';
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
        </div>
        <div className="flex gap-6 sm:flex-col sm:gap-3">
          <Stat value={String(list.length)} label="Products" />
          <Stat value={String(shops.size)} label="Shops" />
          <Stat value={avgRating} label="Avg rating" />
        </div>
      </div>

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
