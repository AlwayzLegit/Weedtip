import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Leaf } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ProductCard } from '@/components/product-card';
import { Badge } from '@/components/ui/badge';
import { pageSeo } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';

const TYPE_LABEL: Record<string, string> = {
  indica: 'Indica',
  sativa: 'Sativa',
  hybrid: 'Hybrid',
  cbd: 'CBD',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('strains')
    .select('name,type,description')
    .eq('slug', slug)
    .maybeSingle();
  if (!data) return { title: 'Strain' };
  const title = `${data.name} — ${TYPE_LABEL[data.type]} strain`;
  const description =
    data.description?.slice(0, 160) ??
    `${data.name} is a ${TYPE_LABEL[data.type]} cannabis strain. Explore its effects, flavors, THC range, and which dispensaries carry it on Weedtip.`;
  return pageSeo({ title, description, path: `/strain/${slug}` });
}

export default async function StrainPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: strain } = await supabase
    .from('strains')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (!strain) notFound();

  // Products carrying this strain at active dispensaries ("where to buy").
  const { data: products } = await supabase
    .from('products')
    .select('*, dispensary:dispensaries!inner(slug,name,status)')
    .eq('strain_id', strain.id)
    .eq('dispensary.status', 'active')
    .order('price_cents');

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Strains', href: '/strains' },
          { name: strain.name, href: `/strain/${strain.slug}` },
        ]}
      />
      <div className="flex items-center gap-2">
        <Leaf className="text-primary h-6 w-6" />
        <h1 className="text-3xl font-bold">{strain.name}</h1>
        <Badge tone="primary">{TYPE_LABEL[strain.type]}</Badge>
      </div>

      {strain.thc_low != null && strain.thc_high != null && (
        <p className="text-muted mt-2">
          THC {strain.thc_low}–{strain.thc_high}%
        </p>
      )}

      {strain.description && <p className="text-muted mt-4 max-w-2xl">{strain.description}</p>}

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {strain.effects.length > 0 && (
          <section>
            <h2 className="text-muted mb-2 text-sm font-semibold uppercase tracking-wide">
              Effects
            </h2>
            <div className="flex flex-wrap gap-2">
              {strain.effects.map((e) => (
                <Badge key={e} tone="primary">
                  {e}
                </Badge>
              ))}
            </div>
          </section>
        )}
        {strain.flavors.length > 0 && (
          <section>
            <h2 className="text-muted mb-2 text-sm font-semibold uppercase tracking-wide">
              Flavors
            </h2>
            <div className="flex flex-wrap gap-2">
              {strain.flavors.map((f) => (
                <Badge key={f} tone="outline">
                  {f}
                </Badge>
              ))}
            </div>
          </section>
        )}
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Where to buy</h2>
        {!products || products.length === 0 ? (
          <p className="text-muted">No dispensaries currently list this strain.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => {
              const dispensary = p.dispensary as { slug: string; name: string } | null;
              return (
                <ProductCard
                  key={p.id}
                  p={{
                    name: p.name,
                    brand: p.brand ?? dispensary?.name ?? null,
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
