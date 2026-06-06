import type { Metadata } from 'next';
import Link from 'next/link';
import { Store } from 'lucide-react';
import { BrandManageForm } from '@/components/dashboard/brand-manage-form';
import { getBrandOwnerContext } from '@/lib/brand-owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Brand profile · Studio' };

export default async function StudioProfile() {
  const { brands } = await getBrandOwnerContext();
  const ids = brands.map((b) => b.id);

  const supabase = await createClient();
  const { data: prods } = await supabase
    .from('products')
    .select('id,brand_id, dispensary:dispensaries!inner(slug,name,status)')
    .in('brand_id', ids)
    .eq('dispensary.status', 'active');

  // brand_id → { products, shops }
  const carried = new Map<string, { products: number; shops: Map<string, string> }>();
  for (const p of prods ?? []) {
    if (!p.brand_id) continue;
    const entry = carried.get(p.brand_id) ?? { products: 0, shops: new Map() };
    entry.products += 1;
    const d = p.dispensary as { slug: string; name: string } | null;
    if (d) entry.shops.set(d.slug, d.name);
    carried.set(p.brand_id, entry);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Profile &amp; media</h1>
        <p className="text-muted mt-1 text-sm">
          Your brand profile enriches every dispensary menu that carries you.
        </p>
      </div>

      {brands.map((b) => {
        const c = carried.get(b.id);
        return (
          <section key={b.id} className="card space-y-5 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{b.name}</h2>
              <Link href={`/brand/${b.slug}`} className="text-primary text-sm hover:underline">
                View public page →
              </Link>
            </div>

            <BrandManageForm brand={b} />

            <div className="border-border border-t pt-4">
              <h3 className="text-muted mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide">
                <Store className="h-4 w-4" /> Carried at ({c?.shops.size ?? 0} shops · {c?.products ?? 0}{' '}
                products)
              </h3>
              {c && c.shops.size > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {[...c.shops.entries()].map(([slug, name]) => (
                    <Link
                      key={slug}
                      href={`/dispensary/${slug}`}
                      className="border-border bg-surface-2 hover:border-primary/50 rounded-full border px-3 py-1 text-sm transition-colors"
                    >
                      {name}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-sm">No active dispensaries carry this brand yet.</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
