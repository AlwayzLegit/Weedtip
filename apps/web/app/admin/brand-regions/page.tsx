import type { Metadata } from 'next';
import Link from 'next/link';
import { deleteBrandAdRegion } from '@/app/admin/actions';
import { BrandRegionForm } from '@/components/admin/brand-region-form';
import { DeleteButton } from '@/components/dashboard/delete-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Brand markets · Admin' };

export default async function AdminBrandRegions() {
  const supabase = await createClient();
  const [{ data: regions }, { data: bids }] = await Promise.all([
    supabase
      .from('brand_ad_regions')
      .select('id,name,slug,state,featured_rate_cents,slots,is_active')
      .order('state'),
    supabase.from('brand_ad_bids').select('region_id').eq('status', 'active'),
  ]);

  // Active bid count per region, so admins can see demand.
  const bidCount = new Map<string, number>();
  for (const b of bids ?? []) bidCount.set(b.region_id, (bidCount.get(b.region_id) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">Advertising</p>
        <h2 className="text-2xl font-bold">Brand markets</h2>
        <p className="text-muted mt-1 text-sm">
          Per-state markets brands bid in to be featured on the Brands directory. Each has a per-term
          rate (floor) and a number of featured slots; the highest bids win (2-month minimum term).
        </p>
      </div>

      <section>
        <h3 className="mb-3 text-lg font-semibold">Add a market</h3>
        <BrandRegionForm region={null} />
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold">Markets ({regions?.length ?? 0})</h3>
        {!regions || regions.length === 0 ? (
          <p className="text-muted text-sm">No markets yet.</p>
        ) : (
          <div className="rounded-card border-border bg-surface divide-border divide-y border">
            {regions.map((r) => {
              const active = bidCount.get(r.id) ?? 0;
              return (
                <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.name}</span>
                      {!r.is_active && <Badge tone="muted">Inactive</Badge>}
                      {active > 0 && <Badge tone="primary">{active} bidding</Badge>}
                    </div>
                    <p className="text-muted text-xs">
                      {r.state} · {formatPrice(r.featured_rate_cents)}/term · {r.slots} slot
                      {r.slots === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link href={`/admin/brand-regions/${r.id}`}>
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </Link>
                    <DeleteButton
                      action={deleteBrandAdRegion.bind(null, r.id)}
                      confirmText="Delete this market? Active bids will be removed."
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
