import type { Metadata } from 'next';
import Link from 'next/link';
import { deleteBrandCatalogProduct } from '@/app/actions/brand-catalog';
import { BrandCatalogForm } from '@/components/dashboard/brand-catalog-form';
import { DeleteButton } from '@/components/dashboard/delete-button';
import { Button } from '@/components/ui/button';
import { getBrandOwnerContext } from '@/lib/brand-owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Catalog · Studio' };

export default async function StudioCatalog() {
  const { brands } = await getBrandOwnerContext();
  const ids = brands.map((b) => b.id);

  const supabase = await createClient();
  const [{ data: items }, { data: categories }] = await Promise.all([
    supabase
      .from('brand_products')
      .select('id,brand_id,name,category_id,strain_type,thc_percentage,image_url,sort_order')
      .in('brand_id', ids)
      .order('sort_order')
      .order('name'),
    supabase.from('categories').select('id,name').order('name'),
  ]);

  const byBrand = new Map<string, NonNullable<typeof items>>();
  for (const it of items ?? []) {
    const list = byBrand.get(it.brand_id) ?? [];
    list.push(it);
    byBrand.set(it.brand_id, list);
  }
  const cats = categories ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Product catalog</h1>
        <p className="text-muted mt-1 text-sm">
          Your brand&apos;s official lineup — shown on your brand page and used to enrich the menus
          that carry you.
        </p>
      </div>

      {brands.map((b) => {
        const list = byBrand.get(b.id) ?? [];
        return (
          <section key={b.id} className="card space-y-5 p-6">
            <h2 className="text-lg font-semibold">{b.name}</h2>

            {list.length > 0 ? (
              <div className="rounded-card border-border bg-surface divide-border divide-y border">
                {list.map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {it.image_url && (
                        <img
                          src={it.image_url}
                          alt={it.name}
                          className="bg-surface-2 border-border h-10 w-10 shrink-0 rounded-lg border object-cover"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium">{it.name}</p>
                        <p className="text-muted text-xs capitalize">
                          {it.strain_type ?? '—'}
                          {it.thc_percentage != null ? ` · ${it.thc_percentage}% THC` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link href={`/studio/catalog/${it.id}`}>
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      </Link>
                      <DeleteButton
                        action={deleteBrandCatalogProduct.bind(null, it.id)}
                        confirmText="Remove this product?"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted text-sm">No catalog products yet.</p>
            )}

            <div className="border-border border-t pt-4">
              <h3 className="text-muted mb-3 text-sm font-semibold uppercase tracking-wide">
                Add a product
              </h3>
              <BrandCatalogForm brandId={b.id} categories={cats} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
