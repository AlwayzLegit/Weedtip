import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/product-card';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('brands').select('name').eq('slug', slug).maybeSingle();
  return { title: data?.name ?? 'Brand' };
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

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold">{brand.name}</h1>
      {brand.description && <p className="text-muted mt-2 max-w-2xl">{brand.description}</p>}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Products</h2>
        {!products || products.length === 0 ? (
          <p className="text-muted">No products from this brand are listed yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => {
              const dispensary = p.dispensary as { slug: string; name: string } | null;
              return (
                <ProductCard
                  key={p.id}
                  p={{
                    name: p.name,
                    brand: brand.name,
                    priceCents: p.price_cents,
                    imageUrl: p.image_urls[0] ?? null,
                    strainType: p.strain_type,
                    thcPercentage: p.thc_percentage,
                    inStock: p.in_stock,
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
