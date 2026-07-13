import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertCircle, ArrowRight, BadgeCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Admin' };

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="card sheen p-5">
      <p className={`text-2xl font-bold tracking-tight ${accent ? 'text-primary' : ''}`}>{value}</p>
      <p className="text-muted mt-0.5 text-sm">{label}</p>
      {sub && <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p>}
    </div>
  );
}

export default async function AdminOverview() {
  const supabase = await createClient();
  const head = { count: 'exact' as const, head: true };

  const [
    { data: orders },
    { data: subs },
    { data: placements },
    active,
    { data: plans },
    pending,
    suspended,
    products,
    users,
    pendingClaims,
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('status,payment_status,total_cents,platform_fee_cents,created_at,dispensary_id,source,device'),
    supabase.from('dispensary_subscriptions').select('status, plan:plans(name, price_cents)'),
    supabase.from('placements').select('price_cents,is_active'),
    supabase.from('dispensaries').select('id', head).eq('status', 'active'),
    supabase.from('plans').select('id,name,price_cents').order('sort_order'),
    supabase.from('dispensaries').select('id', head).eq('status', 'pending'),
    supabase.from('dispensaries').select('id', head).eq('status', 'suspended'),
    supabase.from('products').select('id', head),
    supabase.from('profiles').select('id', head),
    supabase.from('ownership_requests').select('id', head).eq('status', 'pending'),
  ]);

  const orderList = orders ?? [];
  const liveOrders = orderList.filter((o) => o.status !== 'cancelled');
  const paidOrders = orderList.filter((o) => o.payment_status === 'paid');

  // ─── Revenue streams ─────────────────────────────────────────────────────
  const gmv = liveOrders.reduce((s, o) => s + o.total_cents, 0);
  const commission = paidOrders.reduce((s, o) => s + (o.platform_fee_cents ?? 0), 0);
  const mrr = (subs ?? [])
    .filter((s) => s.status === 'active')
    .reduce((sum, s) => sum + ((s.plan as { price_cents: number } | null)?.price_cents ?? 0), 0);
  // Activated placements = sold placements (activation happens after billing
  // is arranged in the sales-led flow).
  const placementSales = (placements ?? [])
    .filter((p) => p.is_active)
    .reduce((s, p) => s + (p.price_cents ?? 0), 0);

  // Head count — the full dispensaries list can't be fetched (9k+ > 1k cap).
  const activeCount = active.count ?? 0;

  // ─── Top dispensaries by revenue ─────────────────────────────────────────
  const revByDisp = new Map<string, number>();
  for (const o of liveOrders) {
    revByDisp.set(o.dispensary_id, (revByDisp.get(o.dispensary_id) ?? 0) + o.total_cents);
  }
  const topIds = [...revByDisp.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);
  // Resolve names for just the top few, rather than fetching (a capped) 9k rows.
  const { data: topNames } = topIds.length
    ? await supabase.from('dispensaries').select('id,name').in('id', topIds)
    : { data: [] as { id: string; name: string }[] };
  const nameById = new Map((topNames ?? []).map((d) => [d.id, d.name] as const));
  const topDispensaries = topIds.map((id) => ({
    id,
    name: nameById.get(id) ?? '—',
    cents: revByDisp.get(id) ?? 0,
  }));

  // ─── Plan distribution ───────────────────────────────────────────────────
  const planCounts = new Map<string, number>();
  for (const s of subs ?? []) {
    const name = (s.plan as { name: string } | null)?.name ?? 'Free';
    if (s.status === 'active') planCounts.set(name, (planCounts.get(name) ?? 0) + 1);
  }

  // ─── 30-day GMV trend ────────────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: { key: string; label: string; cents: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
      cents: 0,
    });
  }
  const dayMap = new Map(days.map((d) => [d.key, d]));
  for (const o of liveOrders) {
    const day = dayMap.get(new Date(o.created_at).toISOString().slice(0, 10));
    if (day) day.cents += o.total_cents;
  }
  const maxCents = Math.max(1, ...days.map((d) => d.cents));
  const last30 = days.reduce((s, d) => s + d.cents, 0);

  // ─── Attribution: marketplace orders by source / device ──────────────────
  const SOURCE_LABEL: Record<string, string> = {
    web: 'Weedtip site',
    embed: 'Embedded menu',
    mobile_web: 'Mobile web',
    pos: 'In-store (POS)',
  };
  const DEVICE_LABEL: Record<string, string> = {
    desktop: 'Desktop',
    mobile: 'Mobile',
    tablet: 'Tablet',
    unknown: 'Unknown',
  };
  function breakdown(key: (o: (typeof liveOrders)[number]) => string, labels: Record<string, string>) {
    const agg = new Map<string, { orders: number; revenue: number }>();
    for (const o of liveOrders) {
      const k = key(o);
      const cur = agg.get(k) ?? { orders: 0, revenue: 0 };
      cur.orders += 1;
      cur.revenue += o.total_cents;
      agg.set(k, cur);
    }
    return [...agg.entries()]
      .map(([k, v]) => ({ key: k, label: labels[k] ?? k, ...v }))
      .sort((a, b) => b.revenue - a.revenue);
  }
  const bySource = breakdown((o) => o.source ?? 'web', SOURCE_LABEL);
  const byDevice = breakdown((o) => o.device ?? 'unknown', DEVICE_LABEL);

  const pendingCount = pending.count ?? 0;
  const claimsCount = pendingClaims.count ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow mb-1">Platform</p>
        <h2 className="text-2xl font-bold sm:text-3xl">Overview</h2>
      </div>

      {/* Attention queue */}
      {(pendingCount > 0 || claimsCount > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {pendingCount > 0 && (
            <Link
              href="/admin/dispensaries?status=pending"
              className="rounded-card border-warning/40 bg-warning/10 hover:border-warning/70 flex items-center justify-between border p-4 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="text-warning h-5 w-5 shrink-0" />
                <span>
                  <strong>{pendingCount}</strong> listing{pendingCount === 1 ? '' : 's'} awaiting
                  approval
                </span>
              </div>
              <ArrowRight className="text-muted h-4 w-4" />
            </Link>
          )}
          {claimsCount > 0 && (
            <Link
              href="/admin/claims"
              className="rounded-card border-primary/30 bg-primary-subtle hover:border-primary/60 flex items-center justify-between border p-4 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm">
                <BadgeCheck className="text-primary h-5 w-5 shrink-0" />
                <span>
                  <strong>{claimsCount}</strong> ownership claim{claimsCount === 1 ? '' : 's'} to
                  review
                </span>
              </div>
              <ArrowRight className="text-muted h-4 w-4" />
            </Link>
          )}
        </div>
      )}

      {/* Revenue streams */}
      <section className="space-y-3">
        <h3 className="text-muted text-sm font-semibold uppercase tracking-wide">Revenue</h3>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="GMV" value={formatPrice(gmv)} sub="all non-cancelled orders" accent />
          <Stat label="Commission" value={formatPrice(commission)} sub="platform take on paid orders" />
          <Stat label="Subscription MRR" value={formatPrice(mrr)} sub="active plans" />
          <Stat label="Placement sales" value={formatPrice(placementSales)} sub="paid placements" />
        </div>
      </section>

      {/* Platform totals */}
      <section className="space-y-3">
        <h3 className="text-muted text-sm font-semibold uppercase tracking-wide">Platform</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Active shops" value={String(activeCount)} />
          <Stat label="Pending" value={String(pendingCount)} />
          <Stat label="Suspended" value={String(suspended.count ?? 0)} />
          <Stat label="Products" value={String(products.count ?? 0)} />
          <Stat label="Orders" value={String(orderList.length)} />
          <Stat label="Users" value={String(users.count ?? 0)} />
        </div>
      </section>

      {/* GMV trend */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">GMV — last 30 days</h3>
          <span className="text-muted text-sm">{formatPrice(last30)}</span>
        </div>
        <div className="card p-4">
          {last30 === 0 ? (
            <p className="text-muted py-8 text-center text-sm">No order revenue in the last 30 days.</p>
          ) : (
            <div className="flex h-40 items-end gap-1">
              {days.map((d) => (
                <div key={d.key} className="group flex flex-1 flex-col items-center justify-end">
                  <div
                    className="bg-primary/70 group-hover:bg-primary w-full rounded-t transition-colors"
                    style={{ height: `${Math.max(2, (d.cents / maxCents) * 100)}%` }}
                    title={`${d.label}: ${formatPrice(d.cents)}`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Attribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        {(
          [
            ['Orders by source', bySource],
            ['Orders by device', byDevice],
          ] as const
        ).map(([title, rowsData]) => {
          const maxRev = Math.max(1, ...rowsData.map((r) => r.revenue));
          return (
            <section key={title}>
              <h3 className="mb-3 text-lg font-semibold">{title}</h3>
              <div className="card p-4">
                {rowsData.length === 0 ? (
                  <p className="text-muted text-sm">No orders yet.</p>
                ) : (
                  <div className="space-y-3">
                    {rowsData.map((r) => (
                      <div key={r.key}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-medium">{r.label}</span>
                          <span className="text-muted">
                            {r.orders} order{r.orders === 1 ? '' : 's'} · {formatPrice(r.revenue)}
                          </span>
                        </div>
                        <div className="bg-surface-2 h-2 overflow-hidden rounded-full">
                          <div
                            className="bg-primary h-full rounded-full"
                            style={{ width: `${Math.max(3, (r.revenue / maxRev) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top dispensaries */}
        <section>
          <h3 className="mb-3 text-lg font-semibold">Top dispensaries by revenue</h3>
          <div className="card divide-border divide-y">
            {topDispensaries.length === 0 ? (
              <p className="text-muted p-4 text-sm">No revenue yet.</p>
            ) : (
              topDispensaries.map((d, i) => (
                <div key={d.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="flex items-center gap-3">
                    <span className="text-muted w-4 text-xs">{i + 1}</span>
                    <span className="font-medium">{d.name}</span>
                  </span>
                  <span className="font-medium">{formatPrice(d.cents)}</span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Plan mix */}
        <section>
          <h3 className="mb-3 text-lg font-semibold">Subscription mix</h3>
          <div className="card divide-border divide-y">
            {(plans ?? []).map((pl) => (
              <div key={pl.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="flex items-center gap-2">
                  <span className="font-medium">{pl.name}</span>
                  <span className="text-muted text-xs">
                    {pl.price_cents === 0 ? 'Free' : `${formatPrice(pl.price_cents)}/mo`}
                  </span>
                </span>
                <Badge tone="muted">{planCounts.get(pl.name) ?? 0} active</Badge>
              </div>
            ))}
          </div>
          <Link href="/admin/promotions" className="mt-3 inline-block">
            <Button variant="outline" size="sm">
              Manage plans & placements <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </section>
      </div>
    </div>
  );
}
