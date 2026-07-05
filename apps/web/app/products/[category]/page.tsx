import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ProductCard } from '@/components/product-card';
import { FaqSection } from '@/components/seo/faq-section';
import { JsonLd } from '@/components/seo/json-ld';
import { CATALOG_IMAGE_EMBED, cardImageUrl } from '@/lib/catalog';
import { itemListJsonLd, pageSeo } from '@/lib/seo';
import { createStaticClient } from '@/lib/supabase/static';

// Public, anon-only page — serve cached HTML and refresh every 15 min (ISR).
export const revalidate = 900;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const supabase = createStaticClient();
  const { data } = await supabase
    .from('categories')
    .select('name')
    .eq('slug', category)
    .maybeSingle();
  if (!data) return { title: 'Products' };
  const title = `Cannabis ${data.name}`;
  const description = `Browse cannabis ${data.name.toLowerCase()} from licensed dispensaries near you — compare prices, THC/CBD, brands, and reviews, then order for pickup or delivery on Weedtip.`;
  return pageSeo({ title, description, path: `/products/${category}` });
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: slug } = await params;
  const supabase = createStaticClient();

  const { data: category } = await supabase
    .from('categories')
    .select('id,name,slug')
    .eq('slug', slug)
    .maybeSingle();
  if (!category) notFound();

  const { data: productData } = await supabase
    .from('products')
    .select(`*, dispensary:dispensaries!inner(slug,status), ${CATALOG_IMAGE_EMBED}`)
    .eq('category_id', category.id)
    .eq('dispensary.status', 'active')
    .order('rating_avg', { ascending: false })
    .order('price_cents');
  const products = productData ?? [];

  // Active storefront sale prices for the listed products.
  const saleMap = new Map<string, number>();
  if (products.length > 0) {
    const { data: sales } = await supabase.rpc('sale_prices_for', {
      p_product_ids: products.map((p) => p.id),
    });
    for (const s of sales ?? []) saleMap.set(s.product_id, s.sale_cents);
  }

  const label = category.name.toLowerCase();
  const faqs = [
    {
      question: `What cannabis ${label} can I buy on Weedtip?`,
      answer: `Weedtip lists ${products.length} ${label} ${products.length === 1 ? 'product' : 'products'} from licensed dispensaries, with prices, THC/CBD, brands, and reviews.`,
    },
    {
      question: `How do I order ${label} for pickup or delivery?`,
      answer: `Open any product to see which dispensary carries it, add it to your cart, and check out for in-store pickup or delivery where available.`,
    },
    {
      question: `Do I need to be 21 to buy ${label}?`,
      answer: `Yes — you must be 21 or older (or a qualifying medical patient where permitted) and present a valid government-issued ID at pickup or delivery.`,
    },
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <JsonLd data={itemListJsonLd(products.map((p) => `/product/${p.id}`))} />
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Products', href: '/products' },
          { name: category.name, href: `/products/${category.slug}` },
        ]}
      />
      <p className="eyebrow mb-1">Category</p>
      <h1 className="text-2xl font-bold sm:text-3xl">Cannabis {category.name}</h1>
      <p className="text-muted mt-1 text-sm">
        {products.length} {products.length === 1 ? 'product' : 'products'} from licensed
        dispensaries.
      </p>

      {products.length === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted mt-6 border p-10 text-center">
          No {label} are listed yet. Check back soon.
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              p={{
                name: p.name,
                brand: p.brand,
                priceCents: saleMap.get(p.id) ?? p.price_cents,
                originalPriceCents: saleMap.has(p.id) ? p.price_cents : null,
                imageUrl: cardImageUrl(p),
                strainType: p.strain_type,
                thcPercentage: p.thc_percentage,
                inStock: p.in_stock,
                rating: p.rating_avg,
                reviewCount: p.rating_count,
                productId: p.id,
              }}
            />
          ))}
        </div>
      )}

      <section className="mt-12 max-w-3xl">
        <h2 className="mb-2 text-lg font-semibold">About cannabis {label} on Weedtip</h2>
        <p className="text-muted text-sm leading-relaxed">
          Compare cannabis {label} from licensed dispensaries near you. Browse by price, potency,
          and brand, read reviews, and order online for pickup or delivery. Always bring a valid
          21+ ID and check your local regulations before ordering.
        </p>
      </section>

      <FaqSection items={faqs} />
    </main>
  );
}
