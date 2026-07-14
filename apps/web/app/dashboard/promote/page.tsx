import type { Metadata } from 'next';
import { EmbedSnippet } from '@/components/dashboard/embed-snippet';
import { PromoteBilling } from '@/components/dashboard/promote-billing';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/format';
import { requireOwnerDispensary } from '@/lib/owner';
import { SITE_URL } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Promote' };

const TYPE_LABEL: Record<string, string> = {
  featured: 'Featured placement',
  hero: 'Homepage spotlight',
  promoted_deal: 'Promoted deal',
  promoted_product: 'Promoted product',
};

function isLive(p: { is_active: boolean; starts_at: string; ends_at: string | null }): boolean {
  const now = Date.now();
  return (
    p.is_active &&
    new Date(p.starts_at).getTime() <= now &&
    (!p.ends_at || new Date(p.ends_at).getTime() >= now)
  );
}

export default async function PromotePage() {
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();

  const [
    { data: sub },
    { data: placements },
    { data: plans },
    { data: stats },
    { data: dealTargets },
    { data: productTargets },
  ] = await Promise.all([
    supabase
      .from('dispensary_subscriptions')
      .select('status, plan:plans(name, price_cents)')
      .eq('dispensary_id', dispensary.id)
      .maybeSingle(),
    supabase
      .from('placements')
      .select('*')
      .eq('dispensary_id', dispensary.id)
      .order('created_at', { ascending: false }),
    supabase.from('plans').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('placement_stats').select('*'),
    supabase
      .from('deals')
      .select('id, title')
      .eq('dispensary_id', dispensary.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('products')
      .select('id, name')
      .eq('dispensary_id', dispensary.id)
      .order('name')
      .limit(200),
  ]);

  const plan = sub?.plan as { name: string; price_cents: number } | null;
  const live = (placements ?? []).filter(isLive);
  const statsByPlacement = new Map((stats ?? []).map((s) => [s.placement_id, s] as const));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Promote {dispensary.name}</h1>
        <p className="text-muted mt-1 text-sm">
          Upgrade your plan or reserve placements to put your shop in front of more customers.
          Reserving is free — our team confirms billing before anything is charged, and placements
          expire automatically.
        </p>
      </div>

      {/* Current plan */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your plan</h2>
        <div className="rounded-card border-border bg-surface flex items-center justify-between border p-5">
          <div>
            <p className="font-medium">{plan?.name ?? 'Free'}</p>
            <p className="text-muted text-sm">
              {plan && plan.price_cents > 0 ? `${formatPrice(plan.price_cents)}/mo` : 'No cost'}
            </p>
          </div>
          <Badge tone={sub?.status === 'active' || !sub ? 'primary' : 'muted'}>
            {sub?.status ?? 'active'}
          </Badge>
        </div>
      </section>

      {/* Active placements */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your placements</h2>
        {!placements || placements.length === 0 ? (
          <div className="rounded-card border-border bg-surface text-muted border p-6 text-center text-sm">
            No active placements. Get featured to climb search results.
          </div>
        ) : (
          <div className="space-y-2">
            {placements.map((p) => (
              <div
                key={p.id}
                className="rounded-card border-border bg-surface flex items-center justify-between border p-4"
              >
                <div>
                  <p className="font-medium">{TYPE_LABEL[p.type] ?? p.type}</p>
                  <p className="text-muted text-xs">
                    {p.scope_city ? `${p.scope_city}, ` : ''}
                    {p.scope_state ?? 'Nationwide'} ·{' '}
                    {new Date(p.starts_at).toLocaleDateString()} –{' '}
                    {p.ends_at ? new Date(p.ends_at).toLocaleDateString() : 'open-ended'}
                  </p>
                  {(() => {
                    const stat = statsByPlacement.get(p.id);
                    const impr = stat?.impressions ?? 0;
                    const clk = stat?.clicks ?? 0;
                    return (
                      <p className="text-muted mt-1 text-xs">
                        {impr.toLocaleString()} impressions · {clk.toLocaleString()} clicks
                        {impr > 0 && ` · ${Math.round((clk / impr) * 1000) / 10}% CTR`}
                      </p>
                    );
                  })()}
                </div>
                <Badge tone={isLive(p) ? 'primary' : 'muted'}>
                  {isLive(p) ? 'Live' : p.is_active ? 'Scheduled' : 'Paused'}
                </Badge>
              </div>
            ))}
          </div>
        )}
        {live.length > 0 && (
          <p className="text-muted text-xs">
            {live.length} placement{live.length === 1 ? '' : 's'} currently live.
          </p>
        )}
      </section>

      {/* Plans + self-serve placement requests */}
      <PromoteBilling
        plans={(plans ?? []).map((pl) => ({
          id: pl.id,
          name: pl.name,
          price_cents: pl.price_cents,
          features: Array.isArray(pl.features) ? (pl.features as string[]) : [],
        }))}
        currentPlanName={sub?.status === 'active' ? (plan?.name ?? 'Free') : 'Free'}
        planPending={sub?.status === 'pending'}
        city={dispensary.city ?? ''}
        state={dispensary.state}
        deals={(dealTargets ?? []).map((d) => ({ id: d.id, label: d.title }))}
        products={(productTargets ?? []).map((p) => ({ id: p.id, label: p.name }))}
      />

      {/* Embeddable menu widget */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Embeddable menu</h2>
          <p className="text-muted mt-1 text-sm">
            Drop your live Weedtip menu onto your own website. It updates automatically — including
            sale prices — and links shoppers back to order.
          </p>
        </div>
        <EmbedSnippet siteUrl={SITE_URL} slug={dispensary.slug} name={dispensary.name} />
      </section>
    </div>
  );
}
