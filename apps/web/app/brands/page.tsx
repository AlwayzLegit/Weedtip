import type { Metadata } from 'next';
import Link from 'next/link';
import { Package, Sparkles } from 'lucide-react';
import { PlacementBeacon } from '@/components/placement-beacon';
import { pageSeo } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = pageSeo({
  title: 'Brands',
  description: 'Browse cannabis brands by state and find their products at dispensaries near you on Weedtip.',
  path: '/brands',
});

type FeaturedRow = {
  id: string;
  scope_state: string | null;
  brand: { slug: string; name: string; description: string | null; logo_url: string | null };
};

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { state: stateParam } = await searchParams;

  const [{ data: brands }, { data: prodBrands }, { data: featured }] = await Promise.all([
    supabase.from('brands').select('id,slug,name,description,logo_url').order('name'),
    supabase
      .from('products')
      .select('brand_id, dispensary:dispensaries!inner(status,state)')
      .eq('dispensary.status', 'active')
      .not('brand_id', 'is', null),
    supabase
      .from('placements')
      .select('id, priority, scope_state, brand:brands!inner(slug,name,description,logo_url)')
      .eq('type', 'promoted_brand')
      .eq('is_active', true)
      .lte('starts_at', nowIso)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order('priority', { ascending: false }),
  ]);

  // Per-brand total + per-state product counts (a brand's states = the states of
  // the active dispensaries that carry it).
  const countByBrand = new Map<string, number>();
  const brandStateCount = new Map<string, Map<string, number>>();
  const stateBrandSets = new Map<string, Set<string>>();
  for (const p of prodBrands ?? []) {
    if (!p.brand_id) continue;
    countByBrand.set(p.brand_id, (countByBrand.get(p.brand_id) ?? 0) + 1);
    const st = (p.dispensary as { state: string } | null)?.state;
    if (!st) continue;
    let m = brandStateCount.get(p.brand_id);
    if (!m) {
      m = new Map();
      brandStateCount.set(p.brand_id, m);
    }
    m.set(st, (m.get(st) ?? 0) + 1);
    if (!stateBrandSets.has(st)) stateBrandSets.set(st, new Set());
    stateBrandSets.get(st)!.add(p.brand_id);
  }

  const allStates = [...stateBrandSets.keys()].sort();
  const selectedState = stateParam && allStates.includes(stateParam) ? stateParam : null;

  const ranked = (brands ?? [])
    .map((b) => ({
      ...b,
      count: selectedState
        ? (brandStateCount.get(b.id)?.get(selectedState) ?? 0)
        : (countByBrand.get(b.id) ?? 0),
    }))
    .filter((b) => (selectedState ? b.count > 0 : true))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const featuredList = ((featured as FeaturedRow[] | null) ?? []).filter(
    (f) => !selectedState || f.scope_state == null || f.scope_state === selectedState,
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-4">
        <p className="eyebrow mb-1">Discover</p>
        <h1 className="text-2xl font-bold sm:text-3xl">
          Brands{selectedState ? ` in ${selectedState}` : ''}
        </h1>
        <p className="text-muted mt-1">Discover brands and where to find their products.</p>
      </div>

      {/* State division */}
      {allStates.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Link
            href="/brands"
            className={
              selectedState
                ? 'border-border text-muted hover:text-foreground rounded-full border px-3 py-1 text-sm'
                : 'border-primary bg-primary-muted text-primary rounded-full border px-3 py-1 text-sm font-medium'
            }
          >
            All states
          </Link>
          {allStates.map((st) => (
            <Link
              key={st}
              href={`/brands?state=${st}`}
              className={
                selectedState === st
                  ? 'border-primary bg-primary-muted text-primary rounded-full border px-3 py-1 text-sm font-medium'
                  : 'border-border text-muted hover:text-foreground rounded-full border px-3 py-1 text-sm'
              }
            >
              {st} ({stateBrandSets.get(st)?.size ?? 0})
            </Link>
          ))}
        </div>
      )}

      {featuredList.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-1.5">
            <Sparkles className="text-primary h-4 w-4" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              Featured brands{selectedState ? ` · ${selectedState}` : ''}
            </h2>
            <span className="text-muted text-xs">· Sponsored</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredList.map((f) => {
              const b = f.brand;
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
        <div className="card text-muted p-10 text-center">
          No brands{selectedState ? ` in ${selectedState}` : ' yet'}.
        </div>
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
                  {selectedState ? ` in ${selectedState}` : ''}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
