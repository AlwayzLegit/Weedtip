import type { Metadata } from 'next';
import { BrandBidRow } from '@/components/dashboard/brand-bid-row';
import { getBrandOwnerContext } from '@/lib/brand-owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Featured bids · Studio' };

export default async function StudioBids() {
  const { brands } = await getBrandOwnerContext();
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
          state&apos;s featured slots; a bid commits to a 2-month term and our team confirms
          billing before it goes live.
        </p>
      </div>

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
                <BrandBidRow key={r.region_id} brandId={brand.id} row={r} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
