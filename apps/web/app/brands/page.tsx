import type { Metadata } from 'next';
import Link from 'next/link';
import { Package, Sparkles } from 'lucide-react';
import { PlacementBeacon } from '@/components/placement-beacon';
import { pageSeo } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = pageSeo({
  title: 'Brands',
  description: 'Browse cannabis brands and find their products at dispensaries near you on Weedtip.',
  path: '/brands',
});

export default async function BrandsPage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [{ data: brands }, { data: prodBrands }, { data: featured }] = await Promise.all([
    supabase.from('brands').select('id,slug,name,description,logo_url').order('name'),
    supabase
      .from('products')
      .select('brand_id, dispensary:dispensaries!inner(status)')
      .eq('dispensary.status', 'active')
      .not('brand_id', 'is', null),
    supabase
      .from('placements')
      .select('id, priority, brand:brands!inner(slug,name,description,logo_url)')
      .eq('type', 'promoted_brand')
      .eq('is_active', true)
      .lte('starts_at', nowIso)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order('priority', { ascending: false }),
  ]);

  // Product counts per brand (a "most stocked" leaderboard proxy).
  const countByBrand = new Map<string, number>();
  for (const p of prodBrands ?? []) {
    if (p.brand_id) countByBrand.set(p.brand_id, (countByBrand.get(p.brand_id) ?? 0) + 1);
  }
  const ranked = (brands ?? [])
    .map((b) => ({ ...b, count: countByBrand.get(b.id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <p className="eyebrow mb-1">Discover</p>
        <h1 className="text-2xl font-bold sm:text-3xl">Brands</h1>
        <p className="text-muted mt-1">Discover brands and where to find their products.</p>
      </div>

      {featured && featured.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-1.5">
            <Sparkles className="text-primary h-4 w-4" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">Featured brands</h2>
            <span className="text-muted text-xs">· Sponsored</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((f) => {
              const b = f.brand as {
                slug: string;
                name: string;
                description: string | null;
                logo_url: string | null;
              };
              return (
                <Link
                  key={f.id}
                  href={`/brand/${b.slug}`}
                  className="rounded-card border-primary/40 bg-primary-muted/30 shadow-card hover:border-primary hover:shadow-card-hover relative flex items-start gap-4 border p-5 transition-all duration-200 hover:-translate-y-0.5"
                >
                  <PlacementBeacon placementId={f.id} />
                  {b.logo_url ? (
                    <img
                      src={b.logo_url}
                      alt={b.name}
                      className="bg-surface-2 border-border h-12 w-12 shrink-0 rounded-xl border object-contain p-1"
                    />
                  ) : (
                    <span className="bg-primary-muted text-primary ring-primary/20 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold ring-1">
                      {b.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-semibold">{b.name}</h3>
                    {b.description && (
                      <p className="text-muted mt-1 line-clamp-2 text-sm">{b.description}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {ranked.length === 0 ? (
        <div className="card text-muted p-10 text-center">No brands yet.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ranked.map((b) => (
            <Link
              key={b.slug}
              href={`/brand/${b.slug}`}
              className="rounded-card border-border bg-surface shadow-card hover:border-primary/50 hover:shadow-card-hover flex items-start gap-4 border p-5 transition-all duration-200 hover:-translate-y-0.5"
            >
              {b.logo_url ? (
                <img
                  src={b.logo_url}
                  alt={b.name}
                  className="bg-surface-2 border-border h-12 w-12 shrink-0 rounded-xl border object-contain p-1"
                />
              ) : (
                <span className="bg-primary-muted text-primary ring-primary/20 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold ring-1">
                  {b.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <h2 className="font-semibold">{b.name}</h2>
                {b.description && (
                  <p className="text-muted mt-1 line-clamp-2 text-sm">{b.description}</p>
                )}
                <p className="text-muted mt-2 flex items-center gap-1 text-xs">
                  <Package className="h-3.5 w-3.5" />
                  {b.count} {b.count === 1 ? 'product' : 'products'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
