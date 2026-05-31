import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Store } from 'lucide-react';
import { AddToCart } from '@/components/cart/add-to-cart';
import { ProductReviewForm } from '@/components/product-review-form';
import { RatingStars } from '@/components/rating-stars';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/format';
import { getAuth } from '@/lib/auth';
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
  const { data } = await supabase.from('products').select('name').eq('id', id).maybeSingle();
  return { title: data?.name ?? 'Product' };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS limits public reads to products of active dispensaries.
  const { data: product } = await supabase
    .from('products')
    .select(
      '*, dispensary:dispensaries(id,slug,name), strain:strains(slug,name), brand:brands(slug,name)',
    )
    .eq('id', id)
    .maybeSingle();
  if (!product) notFound();

  const [{ data: reviews }, { user }] = await Promise.all([
    supabase
      .from('product_reviews')
      .select('id,rating,body,created_at')
      .eq('product_id', id)
      .order('created_at', { ascending: false }),
    getAuth(),
  ]);

  const dispensary = product.dispensary as { id: string; slug: string; name: string } | null;
  const strain = product.strain as { slug: string; name: string } | null;
  const brand = product.brand as { slug: string; name: string } | null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="grid gap-8 sm:grid-cols-2">
        <div
          className="rounded-card border-border from-surface-2 to-surface h-64 border bg-gradient-to-br"
          style={
            product.image_urls[0]
              ? {
                  backgroundImage: `url(${product.image_urls[0]})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined
          }
        />
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
          <p className="text-primary mt-2 text-2xl font-semibold">
            {formatPrice(product.price_cents)}
            {product.unit && <span className="text-muted ml-1 text-sm">/ {product.unit}</span>}
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

          {product.in_stock && dispensary && (
            <div className="mt-5 max-w-xs">
              <AddToCart
                dispensary={{ id: dispensary.id, slug: dispensary.slug, name: dispensary.name }}
                product={{
                  productId: product.id,
                  name: product.name,
                  priceCents: product.price_cents,
                }}
              />
            </div>
          )}
        </div>
      </div>

      {product.description && (
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">Description</h2>
          <p className="text-muted">{product.description}</p>
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Reviews</h2>
        {user ? (
          <div className="rounded-card border-border bg-surface mb-6 border p-4">
            <p className="mb-3 text-sm font-medium">Review this product</p>
            <ProductReviewForm productId={product.id} />
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
                <div className="flex items-center justify-between">
                  <RatingStars rating={r.rating} />
                  <span className="text-muted text-xs">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                {r.body && <p className="text-muted mt-2 text-sm">{r.body}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted">No reviews yet. Be the first.</p>
        )}
      </section>
    </main>
  );
}
