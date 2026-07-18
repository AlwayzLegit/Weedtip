import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { BrandPromote } from '@/components/dashboard/brand-promote';
import { getBrandOwnerContext } from '@/lib/brand-owner';
import { formatPrice } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Promote · Studio' };

function isLive(p: { is_active: boolean; starts_at: string; ends_at: string | null }): boolean {
  const now = Date.now();
  return (
    p.is_active &&
    new Date(p.starts_at).getTime() <= now &&
    (!p.ends_at || new Date(p.ends_at).getTime() >= now)
  );
}

export default async function StudioPromote() {
  const { brands } = await getBrandOwnerContext();

  const ids = brands.map((b) => b.id);
  const supabase = await createClient();
  const { data: promos } = await supabase
    .from('placements')
    .select('id,brand_id,is_active,starts_at,ends_at,price_cents,scope_state')
    .eq('type', 'promoted_brand')
    .in('brand_id', ids)
    .order('created_at', { ascending: false });

  type Promo = NonNullable<typeof promos>[number];
  const byBrand = new Map<string, Promo[]>();
  for (const p of promos ?? []) {
    if (!p.brand_id) continue;
    const list = byBrand.get(p.brand_id) ?? [];
    list.push(p);
    byBrand.set(p.brand_id, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Promote</h1>
        <p className="text-muted mt-1 text-sm">
          Feature your brand on the Brands directory — nationwide or targeted to a state.
        </p>
      </div>

      {brands.map((b) => {
        const live = (byBrand.get(b.id) ?? []).filter(isLive);
        return (
          <section key={b.id} className="card space-y-4 p-6">
            <h2 className="text-lg font-semibold">{b.name}</h2>
            {live.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge tone="primary">Live</Badge>
                {live.map((p) => (
                  <span key={p.id} className="text-muted">
                    {formatPrice(p.price_cents)}
                    {p.scope_state ? ` · ${p.scope_state}` : ' · nationwide'}
                    {p.ends_at ? ` · until ${new Date(p.ends_at).toLocaleDateString()}` : ''}
                  </span>
                ))}
              </div>
            )}
            <BrandPromote brandId={b.id} />
          </section>
        );
      })}
    </div>
  );
}
