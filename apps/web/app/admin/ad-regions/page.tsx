import type { Metadata } from 'next';
import Link from 'next/link';
import { deleteAdRegion } from '@/app/admin/actions';
import { AdRegionForm } from '@/components/admin/ad-region-form';
import { DeleteButton } from '@/components/dashboard/delete-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Ad regions · Admin' };

export default async function AdminAdRegions() {
  const supabase = await createClient();
  const { data: regions } = await supabase
    .from('ad_regions')
    .select('id,name,slug,state,city,featured_rate_cents,slots,is_active')
    .order('state')
    .order('name');

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">Advertising</p>
        <h2 className="text-2xl font-bold">Ad regions</h2>
        <p className="text-muted mt-1 text-sm">
          Markets advertisers can bid in. Each region has a per-term rate (floor) and a number of
          featured slots; the highest bids win the slots (2-month minimum term).
        </p>
      </div>

      <section>
        <h3 className="mb-3 text-lg font-semibold">Add a region</h3>
        <AdRegionForm region={null} />
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold">Regions ({regions?.length ?? 0})</h3>
        {!regions || regions.length === 0 ? (
          <p className="text-muted text-sm">No regions yet.</p>
        ) : (
          <div className="rounded-card border-border bg-surface divide-border divide-y border">
            {regions.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.name}</span>
                    {!r.is_active && <Badge tone="muted">Inactive</Badge>}
                  </div>
                  <p className="text-muted text-xs">
                    {r.city ? `${r.city}, ` : ''}
                    {r.state} · {formatPrice(r.featured_rate_cents)}/term · {r.slots} slot
                    {r.slots === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link href={`/admin/ad-regions/${r.id}`}>
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                  </Link>
                  <DeleteButton action={deleteAdRegion.bind(null, r.id)} confirmText="Delete this region?" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
