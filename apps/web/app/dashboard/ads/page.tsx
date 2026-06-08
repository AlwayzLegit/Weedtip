import type { Metadata } from 'next';
import { AdBidRow } from '@/components/dashboard/ad-bid-row';
import { requireOwnerDispensary } from '@/lib/owner';
import { isStripeConfigured } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Advertise' };

const BILLING_BANNER: Record<string, string> = {
  bid: 'Payment received — your bid is live and competing for a featured slot.',
  cancel: 'Checkout canceled. No charge was made and no bid was placed.',
};

export default async function AdsPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const { dispensary } = await requireOwnerDispensary();
  const { billing } = await searchParams;
  const banner = billing ? BILLING_BANNER[billing] : undefined;
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
          featured slots
          {isStripeConfigured
            ? '; you pay the bid amount upfront for a 2-month term.'
            : '; a new bid commits to a 2-month minimum term, then keeps competing.'}
        </p>
      </div>

      {banner && (
        <div className="rounded-card border-primary/40 bg-primary-muted/40 text-foreground border p-3 text-sm">
          {banner}
        </div>
      )}

      {!rows || rows.length === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted border p-10 text-center text-sm">
          No advertising regions cover {dispensary.city}, {dispensary.state} yet. Check back soon.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <AdBidRow key={r.region_id} row={r} stripeEnabled={isStripeConfigured} />
          ))}
        </div>
      )}
    </div>
  );
}
