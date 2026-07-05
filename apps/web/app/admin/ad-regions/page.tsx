import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';
import { AdRegionForm, StripeSyncForm } from '@/components/admin/ad-region-forms';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Ad regions' };

const TIER_LABEL: Record<string, string> = { A_PLUS: 'A+', A: 'A', B_PLUS: 'B+', B: 'B' };
const SELLABLE_SLOTS = 14; // 1 exclusive + 3 featured + 10 premium

/**
 * Transparent pricing recommendation (Phase 5). Inputs: 30-day demand
 * (searches), engagement (CTR), and occupancy. The launch→list glidepath:
 * raise once a region proves demand, never on a hunch.
 */
function recommend(occupancy: number, searches: number, medianSearches: number): string {
  const demandHigh = searches > 0 && searches >= medianSearches * 1.5;
  if (occupancy >= 0.85) return 'Move to LIST price — nearly sold out';
  if (occupancy >= 0.5 && demandHigh) return 'Ratchet +25% toward list';
  if (occupancy >= 0.5) return 'Ratchet +10% toward list';
  if (demandHigh) return 'Hold launch price — demand strong, push sales';
  return 'Hold launch price';
}

export default async function AdRegionsAdminPage() {
  const supabase = await createClient();
  const [{ data: regions }, { data: metrics }, { data: markets }, { data: adProducts }] =
    await Promise.all([
      supabase
        .from('ad_regions')
        .select('id,slug,name,tier,is_active,sort_order,market:ad_markets(name,state)')
        .order('sort_order'),
      supabase.rpc('region_metrics', { p_days: 30 }),
      supabase.from('ad_markets').select('id,name').order('name'),
      supabase.from('ad_products').select('slot_type,stripe_price_id'),
    ]);

  // Self-serve price book status (exclusive is negotiated — never in Stripe).
  const sellable = (adProducts ?? []).filter((p) => p.slot_type !== 'exclusive');
  const missingPrices = sellable.filter((p) => !p.stripe_price_id).length;

  const byRegion = new Map((metrics ?? []).map((m) => [m.region_id, m]));
  const searchCounts = (metrics ?? []).map((m) => m.searches).sort((a, b) => a - b);
  const medianSearches = searchCounts.length
    ? searchCounts[Math.floor(searchCounts.length / 2)]!
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ad regions</h1>
        <p className="text-muted mt-1 text-sm">
          Occupancy, 30-day demand, and pricing recommendations per sellable territory. Metrics
          come from first-party ad events (searches / impressions / clicks).
        </p>
      </div>

      <section className="card space-y-2 p-5">
        <h2 className="text-sm font-semibold">
          Stripe billing{' '}
          {sellable.length > 0 && (
            <span className={missingPrices > 0 ? 'text-warning' : 'text-primary'}>
              — {sellable.length - missingPrices}/{sellable.length} price book entries connected
            </span>
          )}
        </h2>
        <StripeSyncForm missing={missingPrices} />
      </section>

      <div className="rounded-card border-border bg-surface shadow-card overflow-x-auto border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-surface-2 text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2.5 font-medium">Region</th>
              <th className="px-4 py-2.5 font-medium">Tier</th>
              <th className="px-4 py-2.5 font-medium">Occupancy</th>
              <th className="px-4 py-2.5 font-medium">Searches</th>
              <th className="px-4 py-2.5 font-medium">Impr.</th>
              <th className="px-4 py-2.5 font-medium">Clicks</th>
              <th className="px-4 py-2.5 font-medium">MRR</th>
              <th className="px-4 py-2.5 font-medium">Recommendation</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {(regions ?? []).map((r) => {
              const m = byRegion.get(r.id);
              const occupancy = (m?.live_subs ?? 0) / SELLABLE_SLOTS;
              return (
                <tr key={r.id} className="bg-surface hover:bg-surface-2/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium">{r.name}</span>
                    {!r.is_active && (
                      <Badge tone="muted" className="ml-2">
                        Inactive
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">{TIER_LABEL[r.tier] ?? r.tier}</td>
                  <td className="px-4 py-3">
                    {m?.live_subs ?? 0}/{SELLABLE_SLOTS}
                    <span className="text-muted"> ({Math.round(occupancy * 100)}%)</span>
                  </td>
                  <td className="px-4 py-3">{m?.searches ?? 0}</td>
                  <td className="px-4 py-3">{m?.impressions ?? 0}</td>
                  <td className="px-4 py-3">{m?.clicks ?? 0}</td>
                  <td className="px-4 py-3">{formatPrice(m?.active_revenue_cents ?? 0)}</td>
                  <td className="text-muted px-4 py-3 text-xs">
                    {recommend(occupancy, m?.searches ?? 0, medianSearches)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/ad-regions/${r.id}`}
                      className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
                    >
                      Manage <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {markets && markets.length > 0 && (
        <section className="max-w-2xl space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MapPin className="text-primary h-5 w-5" /> New region
          </h2>
          <p className="text-muted text-sm">
            Creates the fixed slot inventory automatically (1 exclusive + 3 featured + 10
            premium). Add its zones from the region page afterwards.
          </p>
          <AdRegionForm region={{ marketId: markets[0]!.id }} />
        </section>
      )}
    </div>
  );
}
