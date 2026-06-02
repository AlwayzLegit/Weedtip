import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/format';
import { requireOwnerDispensary } from '@/lib/owner';
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

  const [{ data: sub }, { data: placements }, { data: plans }] = await Promise.all([
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
  ]);

  const plan = sub?.plan as { name: string; price_cents: number } | null;
  const live = (placements ?? []).filter(isLive);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Promote {dispensary.name}</h1>
        <p className="text-muted mt-1 text-sm">
          Featured and spotlight placements put your shop in front of more customers. Self-serve
          checkout is coming soon — contact us to activate a placement in the meantime.
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

      {/* Plans / upsell */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Plans</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {(plans ?? []).map((pl) => {
            const features = Array.isArray(pl.features) ? (pl.features as string[]) : [];
            const current = (plan?.name ?? 'Free') === pl.name;
            return (
              <div
                key={pl.id}
                className={`rounded-card bg-surface border p-5 ${
                  current ? 'border-primary' : 'border-border'
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold">{pl.name}</h3>
                  {current && <Badge tone="primary">Current</Badge>}
                </div>
                <p className="mt-1 text-sm font-medium">
                  {pl.price_cents === 0 ? 'Free' : `${formatPrice(pl.price_cents)}/mo`}
                </p>
                <ul className="mt-3 space-y-1.5">
                  {features.map((f) => (
                    <li key={f} className="text-muted flex items-start gap-1.5 text-xs">
                      <Check className="text-primary mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
