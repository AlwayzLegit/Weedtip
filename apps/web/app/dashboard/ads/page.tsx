import type { Metadata } from 'next';
import { AdBidRow } from '@/components/dashboard/ad-bid-row';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Advertise' };

export default async function AdsPage() {
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();
  const { data: rows } = await supabase.rpc('ad_bids_for_owner', {
    p_dispensary_id: dispensary.id,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Advertise</h1>
        <p className="text-muted mt-1 text-sm">
          Bid to feature {dispensary.name} in your market. The highest bids win each region&apos;s
          featured slots; a new bid commits to a 2-month minimum term, then keeps competing.
        </p>
      </div>

      {!rows || rows.length === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted border p-10 text-center text-sm">
          No advertising regions cover {dispensary.city}, {dispensary.state} yet. Check back soon.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <AdBidRow key={r.region_id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}
