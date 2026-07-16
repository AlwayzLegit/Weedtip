import type { Metadata } from 'next';
import { MousePointerClick, Eye, Package, Store } from 'lucide-react';
import { UpgradeWall } from '@/components/dashboard/upgrade-wall';
import { getBrandOwnerContext } from '@/lib/brand-owner';
import { canUseBrandFeature } from '@/lib/brand-plan';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Analytics · Studio' };

export default async function StudioAnalytics() {
  const { brands } = await getBrandOwnerContext();
  const ids = brands.map((b) => b.id);

  // Aggregated across the user's brands — entitled if any one of them is.
  const entitled = (
    await Promise.all(brands.map((b) => canUseBrandFeature(b.id, 'brand_analytics')))
  ).some(Boolean);
  if (!entitled) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <UpgradeWall
          feature="Brand analytics"
          tier="basic"
          href="/for-brands"
          description="Upgrade to Basic to see your brand's views, followers, and where your products are stocked. Your brand page stays live for free."
        />
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: placements }, { data: prods }] = await Promise.all([
    supabase.from('placements').select('id,brand_id').eq('type', 'promoted_brand').in('brand_id', ids),
    supabase
      .from('products')
      .select('brand_id, dispensary:dispensaries!inner(slug,name,state,status)')
      .in('brand_id', ids)
      .eq('dispensary.status', 'active'),
  ]);

  const placementIds = (placements ?? []).map((p) => p.id);
  const { data: stats } = placementIds.length
    ? await supabase.from('placement_stats').select('*').in('placement_id', placementIds)
    : { data: [] };

  // placement_id → brand_id, then fold stats into per-brand totals.
  const brandByPlacement = new Map((placements ?? []).map((p) => [p.id, p.brand_id] as const));
  const perf = new Map<string, { impressions: number; clicks: number }>();
  for (const s of stats ?? []) {
    const bid = s.placement_id ? brandByPlacement.get(s.placement_id) : null;
    if (!bid) continue;
    const e = perf.get(bid) ?? { impressions: 0, clicks: 0 };
    e.impressions += s.impressions ?? 0;
    e.clicks += s.clicks ?? 0;
    perf.set(bid, e);
  }

  // Reach: per brand → shops, products, and a per-state breakdown.
  type Reach = { shops: Set<string>; products: number; byState: Map<string, number> };
  const reach = new Map<string, Reach>();
  for (const p of prods ?? []) {
    if (!p.brand_id) continue;
    const d = p.dispensary as { slug: string; state: string } | null;
    const e = reach.get(p.brand_id) ?? { shops: new Set(), products: 0, byState: new Map() };
    e.products += 1;
    if (d) {
      e.shops.add(d.slug);
      e.byState.set(d.state, (e.byState.get(d.state) ?? 0) + 1);
    }
    reach.set(p.brand_id, e);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Analytics &amp; reach</h1>
        <p className="text-muted mt-1 text-sm">
          How your promotions perform and where your products are carried.
        </p>
      </div>

      {brands.map((b) => {
        const pf = perf.get(b.id) ?? { impressions: 0, clicks: 0 };
        const ctr = pf.impressions > 0 ? (pf.clicks / pf.impressions) * 100 : 0;
        const r = reach.get(b.id);
        const states = r ? [...r.byState.entries()].sort(([, a], [, c]) => c - a) : [];
        const maxState = states[0]?.[1] ?? 1;
        return (
          <section key={b.id} className="card space-y-5 p-6">
            <h2 className="text-lg font-semibold">{b.name}</h2>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat icon={Eye} label="Impressions" value={pf.impressions.toLocaleString()} />
              <Stat icon={MousePointerClick} label="Clicks" value={pf.clicks.toLocaleString()} />
              <Stat icon={MousePointerClick} label="CTR" value={`${ctr.toFixed(1)}%`} />
              <Stat icon={Store} label="Shops carrying" value={(r?.shops.size ?? 0).toLocaleString()} />
            </div>

            <div className="border-border border-t pt-4">
              <h3 className="text-muted mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide">
                <Package className="h-4 w-4" /> Reach by state ({r?.products ?? 0} products total)
              </h3>
              {states.length > 0 ? (
                <div className="space-y-1.5">
                  {states.map(([st, count]) => {
                    return (
                      <div key={st} className="flex items-center gap-3 text-sm">
                        <span className="w-8 font-medium">{st}</span>
                        <div className="bg-surface-2 h-2 flex-1 overflow-hidden rounded-full">
                          <div
                            className="bg-primary h-full rounded-full"
                            style={{ width: `${Math.max(6, (count / maxState) * 100)}%` }}
                          />
                        </div>
                        <span className="text-muted w-20 text-right">
                          {count} product{count === 1 ? '' : 's'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted text-sm">No active dispensaries carry this brand yet.</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-card border-border bg-surface-2 border p-3">
      <p className="text-muted flex items-center gap-1.5 text-xs font-medium">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
