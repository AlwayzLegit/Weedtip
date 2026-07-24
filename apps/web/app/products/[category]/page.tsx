import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Link } from 'next-view-transitions';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { LineupCard, type LineupItem } from '@/components/brand/lineup-card';
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
  const description = `Browse cannabis ${data.name.toLowerCase()} from licensed dispensaries near you — compare prices, THC/CBD, brands, and reviews on Weedtip.`;
  return pageSeo({ title, description, path: `/products/${category}` });
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = await params;
  const supabase = createStaticClient();

  const { data: category } = await supabase
    .from('categories')
    .select('id,name,slug')
    .eq('slug', slug)
    .maybeSingle();
  if (!category) notFound();

  const { data: productData, count: productCount } = await supabase
    .from('products')
    .select(`*, dispensary:dispensaries!inner(slug,status), ${CATALOG_IMAGE_EMBED}`, {
      count: 'exact',
    })
    .eq('category_id', category.id)
    .eq('dispensary.status', 'active')
    .order('rating_avg', { ascending: false })
    .order('price_cents')
    .limit(48);
  const products = productData ?? [];
  const totalProducts = productCount ?? products.length;

  // Active storefront sale prices for the listed products.
  const saleMap = new Map<string, number>();
  if (products.length > 0) {
    const { data: sales } = await supabase.rpc('sale_prices_for', {
      p_product_ids: products.map((p) => p.id),
    });
    for (const s of sales ?? []) saleMap.set(s.product_id, s.sale_cents);
  }

  // Official brand-catalog lineup for this category — real product depth while
  // dispensary menus ramp up. Cards link to the brand page, whose "Carried at"
  // section is the path to purchase.
  const { data: lineupData, count: lineupCount } = await supabase
    .from('brand_products')
    .select(
      'id,name,strain_type,thc_percentage,description,image_url,brand:brands!inner(name,slug,logo_url)',
      {
        count: 'exact',
      },
    )
    .eq('category_id', category.id)
    .order('sort_order')
    .order('name')
    .limit(48);
  const lineup: LineupItem[] = (lineupData ?? []).map((it) => {
    const brand = it.brand as unknown as { name: string; slug: string; logo_url: string | null };
    return {
      id: it.id,
      name: it.name,
      strainType: it.strain_type,
      thcPercentage: it.thc_percentage,
      description: it.description,
      imageUrl: it.image_url,
      brandName: brand.name,
      brandSlug: brand.slug,
      brandLogoUrl: brand.logo_url,
    };
  });

  const label = category.name.toLowerCase();
  const faqs = [
    {
      question: `What cannabis ${label} can I buy on Weedtip?`,
      answer: `Weedtip lists ${totalProducts} ${label} ${totalProducts === 1 ? 'product' : 'products'} from licensed dispensary menus, plus ${lineupCount ?? 0} from official brand catalogs, with THC/CBD, brands, and reviews.`,
    },
    {
      question: `How do I find ${label} near me?`,
      answer: `Open any product to see which dispensaries carry it, then browse each shop's menu, prices, hours, and reviews to find the right one near you.`,
    },
    {
      question: `Do I need to be 21 to buy ${label}?`,
      answer: `Yes — you must be 21 or older (or a qualifying medical patient where permitted) and present a valid government-issued ID at the dispensary.`,
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
        {totalProducts} {totalProducts === 1 ? 'product' : 'products'} from licensed dispensaries.
      </p>

      {products.length === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted mt-6 border p-10 text-center">
          No {label} are on dispensary menus yet — browse the brand catalogs below.
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
                categorySlug: slug,
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

      {products.length > 0 && (
        <Link
          href={`/products?category=${category.slug}`}
          className="text-primary mt-4 inline-block text-sm font-medium hover:underline"
        >
          Filter all {category.name.toLowerCase()} →
        </Link>
      )}

      {lineup.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold">From brand catalogs</h2>
          <p className="text-muted mt-1 text-sm">
            {(lineupCount ?? lineup.length).toLocaleString()} {label} in official brand lineups —
            open a brand to see where it&apos;s carried.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {lineup.map((it) => (
              <LineupCard key={it.id} item={it} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-12 max-w-3xl">
        <h2 className="mb-2 text-lg font-semibold">About cannabis {label} on Weedtip</h2>
        <p className="text-muted text-sm leading-relaxed">
          Compare cannabis {label} from licensed dispensaries near you. Browse by price, potency,
          and brand, and read reviews to find the right shop near you. Always bring a valid 21+ ID
          and check your local regulations before you visit.
        </p>
      </section>

      <FaqSection items={faqs} />
    </main>
  );
}
