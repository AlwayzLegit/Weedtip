import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ProductCard } from '@/components/product-card';
import { FaqSection } from '@/components/seo/faq-section';
import { JsonLd } from '@/components/seo/json-ld';
import { CATALOG_IMAGE_EMBED, cardImageUrl } from '@/lib/catalog';
import { citySlug, itemListJsonLd, pageSeo, US_STATES } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';

async function load(state: string, city: string, categorySlug: string) {
  const code = state.toUpperCase();
  const stateName = US_STATES[code];
  if (!stateName) return null;

  const supabase = await createClient();
  const { data: category } = await supabase
    .from('categories')
    .select('id,name,slug')
    .eq('slug', categorySlug)
    .maybeSingle();
  if (!category) return null;

  // Resolve the city's display name from active dispensaries in the state.
  const { data: cityRows } = await supabase
    .from('dispensaries')
    .select('city')
    .eq('status', 'active')
    .eq('state', code);
  const cityName = (cityRows ?? [])
    .map((r) => r.city)
    .find((c) => citySlug(c ?? '') === city.toLowerCase());
  if (!cityName) return null;

  const { data: productData } = await supabase
    .from('products')
    .select(`*, dispensary:dispensaries!inner(slug,city,state,status), ${CATALOG_IMAGE_EMBED}`)
    .eq('category_id', category.id)
    .eq('dispensary.status', 'active')
    .eq('dispensary.state', code)
    .order('rating_avg', { ascending: false })
    .order('price_cents');
  const products = (productData ?? []).filter((p) => {
    const d = p.dispensary as { city: string } | null;
    return d && citySlug(d.city) === city.toLowerCase();
  });

  return { stateName, cityName, category, products };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string; city: string; category: string }>;
}): Promise<Metadata> {
  const { state, city, category } = await params;
  const found = await load(state, city, category);
  if (!found) return { title: 'Products' };
  const title = `Cannabis ${found.category.name} in ${found.cityName}, ${state.toUpperCase()}`;
  const description = `Find cannabis ${found.category.name.toLowerCase()} from licensed dispensaries in ${found.cityName}, ${found.stateName}. Compare prices, THC/CBD, and reviews, then order for pickup or delivery on Weedtip.`;
  return pageSeo({
    title,
    description,
    path: `/dispensaries/${state.toLowerCase()}/${city.toLowerCase()}/${category.toLowerCase()}`,
  });
}

export default async function CategoryInCityPage({
  params,
}: {
  params: Promise<{ state: string; city: string; category: string }>;
}) {
  const { state, city, category } = await params;
  const found = await load(state, city, category);
  if (!found) notFound();
  const { stateName, cityName, products } = found;
  const label = found.category.name.toLowerCase();
  const base = `/dispensaries/${state.toLowerCase()}/${city.toLowerCase()}`;

  const faqs = [
    {
      question: `What cannabis ${label} can I buy in ${cityName}?`,
      answer: `Weedtip lists ${products.length} ${label} ${products.length === 1 ? 'product' : 'products'} from licensed dispensaries in ${cityName}, ${stateName}, with prices, potency, and reviews.`,
    },
    {
      question: `How do I order ${label} in ${cityName} for pickup or delivery?`,
      answer: `Open a product to see which ${cityName} dispensary carries it, add it to your cart, and check out for pickup or delivery where available.`,
    },
    {
      question: `Do I need to be 21 to buy ${label} in ${cityName}?`,
      answer: `Yes — you must be 21 or older (or a qualifying medical patient where permitted) and present a valid government-issued ID.`,
    },
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <JsonLd data={itemListJsonLd(products.map((p) => `/product/${p.id}`))} />
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Dispensaries', href: '/dispensaries' },
          { name: stateName, href: `/dispensaries/${state.toLowerCase()}` },
          { name: cityName, href: base },
          { name: found.category.name, href: `${base}/${found.category.slug}` },
        ]}
      />
      <h1 className="text-2xl font-bold">
        Cannabis {found.category.name} in {cityName}, {state.toUpperCase()}
      </h1>
      <p className="text-muted mt-1 text-sm">
        {products.length} {products.length === 1 ? 'product' : 'products'} from {cityName}{' '}
        dispensaries.
      </p>

      {products.length === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted mt-6 border p-10 text-center">
          No {label} listed in {cityName} yet. Check back soon.
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
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
              }}
            />
          ))}
        </div>
      )}

      <FaqSection items={faqs} />
    </main>
  );
}
