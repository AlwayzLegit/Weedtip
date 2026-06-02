import type { Metadata } from 'next';
import { deletePlacement, setPlacementActive } from '@/app/admin/actions';
import { PlacementForm } from '@/components/admin/placement-form';
import { PlanAssignForm } from '@/components/admin/plan-assign-form';
import { DeleteButton } from '@/components/dashboard/delete-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Promotions' };

const TYPE_LABEL: Record<string, string> = {
  featured: 'Featured',
  hero: 'Hero',
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

export default async function AdminPromotions() {
  const supabase = await createClient();

  const [{ data: dispensaries }, { data: plans }, { data: placements }, { data: subs }, { data: stats }] =
    await Promise.all([
      supabase.from('dispensaries').select('id,name').order('name'),
      supabase.from('plans').select('*').order('sort_order'),
      supabase
        .from('placements')
        .select('*, dispensary:dispensaries(name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('dispensary_subscriptions')
        .select('*, dispensary:dispensaries(name), plan:plans(name)'),
      supabase.from('placement_stats').select('*'),
    ]);

  const disp = dispensaries ?? [];
  const planList = plans ?? [];
  const statsByPlacement = new Map(
    (stats ?? []).map((s) => [s.placement_id, s] as const),
  );

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-bold">Promotions & monetization</h2>
        <p className="text-muted mt-1 text-sm">
          Grant paid placements and assign subscription tiers. Featured placements drive search
          ranking automatically and expire on their end date.
        </p>
      </div>

      {/* Placements */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Active & scheduled placements</h3>
        {!placements || placements.length === 0 ? (
          <div className="rounded-card border-border bg-surface text-muted border p-6 text-center text-sm">
            No placements yet.
          </div>
        ) : (
          <div className="rounded-card border-border overflow-hidden border">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-muted text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Dispensary</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="hidden px-4 py-2 font-medium sm:table-cell">Scope</th>
                  <th className="hidden px-4 py-2 font-medium sm:table-cell">Window</th>
                  <th className="px-4 py-2 font-medium">Performance</th>
                  <th className="px-4 py-2 font-medium">State</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {placements.map((p) => {
                  const dispensary = p.dispensary as { name: string } | null;
                  const live = isLive(p);
                  const stat = statsByPlacement.get(p.id);
                  const impressions = stat?.impressions ?? 0;
                  const clicks = stat?.clicks ?? 0;
                  const ctr = impressions ? Math.round((clicks / impressions) * 1000) / 10 : 0;
                  return (
                    <tr key={p.id} className="bg-surface">
                      <td className="px-4 py-3 font-medium">{dispensary?.name ?? '—'}</td>
                      <td className="px-4 py-3">{TYPE_LABEL[p.type] ?? p.type}</td>
                      <td className="text-muted hidden px-4 py-3 sm:table-cell">
                        {p.scope_city ? `${p.scope_city}, ` : ''}
                        {p.scope_state ?? 'Nationwide'}
                      </td>
                      <td className="text-muted hidden px-4 py-3 text-xs sm:table-cell">
                        {new Date(p.starts_at).toLocaleDateString()} –{' '}
                        {p.ends_at ? new Date(p.ends_at).toLocaleDateString() : '∞'}
                      </td>
                      <td className="text-muted px-4 py-3 text-xs">
                        {impressions.toLocaleString()} impr · {clicks.toLocaleString()} clk
                        {impressions > 0 && ` · ${ctr}% CTR`}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={live ? 'primary' : 'muted'}>
                          {live ? 'Live' : p.is_active ? 'Scheduled' : 'Paused'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <form
                            action={setPlacementActive.bind(
                              null,
                              p.id,
                              !p.is_active,
                              p.dispensary_id,
                            )}
                          >
                            <Button type="submit" size="sm" variant="ghost">
                              {p.is_active ? 'Pause' : 'Resume'}
                            </Button>
                          </form>
                          <DeleteButton
                            action={deletePlacement.bind(null, p.id, p.dispensary_id)}
                            confirmText="Delete this placement?"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* New placement */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Grant a placement</h3>
        <div className="rounded-card border-border bg-surface border p-5">
          <PlacementForm dispensaries={disp} />
        </div>
      </section>

      {/* Plans */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Subscription tiers</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {planList.map((plan) => {
            const features = Array.isArray(plan.features) ? (plan.features as string[]) : [];
            return (
              <div key={plan.id} className="rounded-card border-border bg-surface border p-5">
                <div className="flex items-baseline justify-between">
                  <h4 className="font-semibold">{plan.name}</h4>
                  <span className="text-sm font-medium">
                    {plan.price_cents === 0 ? 'Free' : `${formatPrice(plan.price_cents)}/mo`}
                  </span>
                </div>
                {plan.description && (
                  <p className="text-muted mt-1 text-xs">{plan.description}</p>
                )}
                <ul className="text-muted mt-3 space-y-1 text-xs">
                  {features.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Subscriptions */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Assign a tier</h3>
        <div className="rounded-card border-border bg-surface border p-5">
          <PlanAssignForm
            dispensaries={disp}
            plans={planList.map((p) => ({ id: p.id, name: p.name }))}
          />
        </div>

        {subs && subs.length > 0 && (
          <div className="rounded-card border-border overflow-hidden border">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-muted text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Dispensary</th>
                  <th className="px-4 py-2 font-medium">Plan</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {subs.map((s) => {
                  const dispensary = s.dispensary as { name: string } | null;
                  const plan = s.plan as { name: string } | null;
                  return (
                    <tr key={s.id} className="bg-surface">
                      <td className="px-4 py-3 font-medium">{dispensary?.name ?? '—'}</td>
                      <td className="text-muted px-4 py-3">{plan?.name ?? 'None'}</td>
                      <td className="px-4 py-3">
                        <Badge tone={s.status === 'active' ? 'primary' : 'muted'}>{s.status}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
