import type { Metadata } from 'next';
import { productSearchSchema, type StrainType } from '@weedtip/shared';
import { searchProducts } from '@weedtip/supabase/queries';
import { ProductCard } from '@/components/product-card';
import { ProductFilters } from '@/components/product-filters';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Products' };

type SearchParams = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (typeof v === 'string' && v ? v : undefined);
const int = (v: string | string[] | undefined) => {
  const s = str(v);
  return s && Number.isFinite(Number(s)) ? Number(s) : undefined;
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const params = productSearchSchema.parse({
    query: str(sp.query),
    category_slug: str(sp.category),
    strain_type: str(sp.strain) as StrainType | undefined,
    max_price_cents: int(sp.max_price),
    in_stock_only: sp.in_stock === 'false' ? false : true,
    page: int(sp.page),
  });

  const supabase = await createClient();
  const [{ data: categories }, productsRes] = await Promise.all([
    supabase.from('categories').select('name,slug').order('sort_order'),
    searchProducts(supabase, params),
  ]);

  const rows = productsRes.data ?? [];

  // Resolve dispensary slugs for product → shop links.
  const dispensaryIds = [...new Set(rows.map((r) => r.dispensary_id))];
  const slugById = new Map<string, string>();
  if (dispensaryIds.length > 0) {
    const { data: shops } = await supabase
      .from('dispensaries')
      .select('id,slug')
      .in('id', dispensaryIds);
    shops?.forEach((s) => slugById.set(s.id, s.slug));
  }

  const total = rows[0]?.total_count ?? 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 space-y-4">
        <h1 className="text-2xl font-bold">Products</h1>
        <ProductFilters categories={categories ?? []} />
      </div>

      <p className="text-muted mb-4 text-sm">
        {total} {total === 1 ? 'product' : 'products'}
      </p>

      {rows.length === 0 ? (
        <div className="rounded-card border-border bg-surface border p-10 text-center">
          <p className="font-medium">No products found</p>
          <p className="text-muted mt-1 text-sm">Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {rows.map((p) => (
            <ProductCard
              key={p.id}
              p={{
                name: p.name,
                brand: p.brand,
                priceCents: p.price_cents,
                imageUrl: p.image_urls[0] ?? null,
                strainType: p.strain_type,
                thcPercentage: p.thc_percentage,
                inStock: p.in_stock,
                productId: p.id,
                dispensarySlug: slugById.get(p.dispensary_id),
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}
