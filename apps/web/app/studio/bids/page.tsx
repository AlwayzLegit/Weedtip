import type { Metadata } from 'next';
import { BrandBidRow } from '@/components/dashboard/brand-bid-row';
import { getBrandOwnerContext } from '@/lib/brand-owner';
import { isStripeConfigured } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Featured bids · Studio' };

const BILLING_BANNER: Record<string, string> = {
  bid: 'Payment received — your bid is live and competing for a featured slot.',
  cancel: 'Checkout canceled. No charge was made and no bid was placed.',
};

export default async function StudioBids({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const { brands } = await getBrandOwnerContext();
  const { billing } = await searchParams;
  const banner = billing ? BILLING_BANNER[billing] : undefined;
  const supabase = await createClient();

  const bidsByBrand = await Promise.all(
    brands.map(async (b) => {
      const { data } = await supabase.rpc('brand_bids_for_owner', { p_brand_id: b.id });
      return { brand: b, rows: data ?? [] };
    }),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Featured bids</h1>
        <p className="text-muted mt-1 text-sm">
          Bid to feature your brand on the Brands directory in each state. The highest bids win the
          state&apos;s featured slots
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

      {bidsByBrand.map(({ brand, rows }) => (
        <section key={brand.id} className="space-y-3">
          {brands.length > 1 && <h2 className="text-lg font-semibold">{brand.name}</h2>}
          {rows.length === 0 ? (
            <div className="rounded-card border-border bg-surface text-muted border p-10 text-center text-sm">
              No brand markets are open for bidding yet. Check back soon.
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <BrandBidRow
                  key={r.region_id}
                  brandId={brand.id}
                  row={r}
                  stripeEnabled={isStripeConfigured}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
