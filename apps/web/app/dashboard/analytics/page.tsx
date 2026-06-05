import type { Metadata } from 'next';
import Link from 'next/link';
import { Download, Star } from 'lucide-react';
import { type OrderItem } from '@weedtip/shared';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/format';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Analytics' };

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card sheen p-5">
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <p className="text-muted mt-0.5 text-sm">{label}</p>
      {sub && <p className="text-muted mt-0.5 text-xs">{sub}</p>}
    </div>
  );
}

export default async function AnalyticsPage() {
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();

  const [{ data }, { data: redemptions }, { data: staff }] = await Promise.all([
    supabase
      .from('orders')
      .select(
        'status,total_cents,platform_fee_cents,platform_fee_bps,created_at,items,source,device,sold_by_staff',
      )
      .eq('dispensary_id', dispensary.id),
    supabase
      .from('deal_redemptions')
      .select('code, discount_cents, deal:deals(title)')
      .eq('dispensary_id', dispensary.id),
    supabase.from('pos_staff').select('id,name').eq('dispensary_id', dispensary.id),
  ]);

  const orders = data ?? [];
  const live = orders.filter((o) => o.status !== 'cancelled');
  const totalRevenue = live.reduce((s, o) => s + o.total_cents, 0);
  const aov = live.length ? totalRevenue / live.length : 0;
  const cancelled = orders.filter((o) => o.status === 'cancelled').length;
  const cancelRate = orders.length ? Math.round((cancelled / orders.length) * 100) : 0;

  // Platform commission across non-cancelled orders, and the current take-rate.
  const platformFees = live.reduce((s, o) => s + (o.platform_fee_cents ?? 0), 0);
  const feeBps = live.find((o) => o.platform_fee_bps > 0)?.platform_fee_bps ?? 0;
  const netRevenue = totalRevenue - platformFees;

  const byStatus = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});
  const STATUS_ORDER = ['pending', 'confirmed', 'ready', 'completed', 'cancelled'];

  // ─── Revenue, last 30 days ───────────────────────────────────────────────
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
  for (const o of live) {
    const day = dayMap.get(new Date(o.created_at).toISOString().slice(0, 10));
    if (day) day.cents += o.total_cents;
  }
  const maxCents = Math.max(1, ...days.map((d) => d.cents));
  const last30Revenue = days.reduce((s, d) => s + d.cents, 0);

  // ─── Top products (from order item snapshots) ────────────────────────────
  const productAgg = new Map<string, { units: number; revenue: number }>();
  for (const o of live) {
    for (const it of (o.items as OrderItem[]) ?? []) {
      const cur = productAgg.get(it.name) ?? { units: 0, revenue: 0 };
      cur.units += it.quantity;
      cur.revenue += it.unit_price_cents * it.quantity;
      productAgg.set(it.name, cur);
    }
  }
  const topProducts = [...productAgg.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // ─── Attribution: where orders come from ─────────────────────────────────
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
  function breakdown(key: (o: (typeof live)[number]) => string, labels: Record<string, string>) {
    const agg = new Map<string, { orders: number; revenue: number }>();
    for (const o of live) {
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

  // ─── Staff sales leaderboard (POS, by operator) ──────────────────────────
  const staffName = new Map((staff ?? []).map((s) => [s.id, s.name]));
  const staffAgg = new Map<string, { orders: number; revenue: number }>();
  for (const o of live) {
    if (!o.sold_by_staff) continue;
    const cur = staffAgg.get(o.sold_by_staff) ?? { orders: 0, revenue: 0 };
    cur.orders += 1;
    cur.revenue += o.total_cents;
    staffAgg.set(o.sold_by_staff, cur);
  }
  const staffLeaderboard = [...staffAgg.entries()]
    .map(([id, v]) => ({ id, name: staffName.get(id) ?? 'Removed staff', ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  // ─── Promo code performance ──────────────────────────────────────────────
  const promoAgg = new Map<string, { title: string; uses: number; discount: number }>();
  for (const r of redemptions ?? []) {
    const deal = r.deal as { title: string } | null;
    const cur = promoAgg.get(r.code) ?? { title: deal?.title ?? r.code, uses: 0, discount: 0 };
    cur.uses += 1;
    cur.discount += r.discount_cents;
    promoAgg.set(r.code, cur);
  }
  const promoRows = [...promoAgg.entries()]
    .map(([code, v]) => ({ code, ...v }))
    .sort((a, b) => b.uses - a.uses);
  const totalDiscount = promoRows.reduce((s, p) => s + p.discount, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted text-sm">{dispensary.name}</p>
        </div>
        <Link href="/dashboard/analytics/order-items">
          <span className="border-border bg-surface hover:bg-surface-2 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium">
            <Download className="h-4 w-4" /> Export order items (CSV)
          </span>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Revenue (all-time)" value={formatPrice(totalRevenue)} sub="excludes cancelled" />
        <Stat label="Orders" value={String(orders.length)} sub={`${live.length} active`} />
        <Stat label="Avg order value" value={formatPrice(Math.round(aov))} />
        <Stat label="Cancellation rate" value={`${cancelRate}%`} sub={`${cancelled} cancelled`} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat
          label="Platform fees"
          value={formatPrice(platformFees)}
          sub={feeBps ? `${(feeBps / 100).toFixed(feeBps % 100 ? 2 : 0)}% commission` : 'commission'}
        />
        <Stat label="Net revenue" value={formatPrice(netRevenue)} sub="after platform fees" />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Revenue — last 30 days</h2>
          <span className="text-muted text-sm">{formatPrice(last30Revenue)}</span>
        </div>
        <div className="rounded-card border-border bg-surface border p-4">
          {last30Revenue === 0 ? (
            <p className="text-muted py-8 text-center text-sm">No revenue in the last 30 days yet.</p>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Orders by status</h2>
          <div className="rounded-card border-border bg-surface divide-border divide-y border">
            {STATUS_ORDER.filter((s) => byStatus[s]).length === 0 ? (
              <p className="text-muted p-4 text-sm">No orders yet.</p>
            ) : (
              STATUS_ORDER.filter((s) => byStatus[s]).map((s) => (
                <div key={s} className="flex items-center justify-between px-4 py-3 text-sm">
                  <Badge tone={s === 'completed' || s === 'cancelled' ? 'muted' : 'primary'}>{s}</Badge>
                  <span className="font-medium">{byStatus[s]}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Rating</h2>
          <div className="rounded-card border-border bg-surface flex items-center gap-3 border p-4">
            <Star className="text-primary h-6 w-6 fill-current" />
            <div>
              <p className="text-2xl font-bold">
                {dispensary.rating_count > 0 ? dispensary.rating_avg.toFixed(1) : '—'}
              </p>
              <p className="text-muted text-sm">
                {dispensary.rating_count} review{dispensary.rating_count === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {(
          [
            ['Orders by source', bySource],
            ['Orders by device', byDevice],
          ] as const
        ).map(([title, rows]) => {
          const maxRev = Math.max(1, ...rows.map((r) => r.revenue));
          return (
            <section key={title}>
              <h2 className="mb-3 text-lg font-semibold">{title}</h2>
              <div className="rounded-card border-border bg-surface border p-4">
                {rows.length === 0 ? (
                  <p className="text-muted text-sm">No orders yet.</p>
                ) : (
                  <div className="space-y-3">
                    {rows.map((r) => (
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

      {staffLeaderboard.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Sales by staff</h2>
          <div className="rounded-card border-border bg-surface overflow-hidden border">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-muted text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Budtender</th>
                  <th className="px-4 py-2 font-medium">Sales</th>
                  <th className="px-4 py-2 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {staffLeaderboard.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2 font-medium">{s.name}</td>
                    <td className="px-4 py-2">{s.orders}</td>
                    <td className="px-4 py-2">{formatPrice(s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Top products</h2>
        <div className="rounded-card border-border bg-surface shadow-card overflow-hidden border">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-muted text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 text-right font-medium">Units</th>
                <th className="px-4 py-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {topProducts.length === 0 ? (
                <tr className="bg-surface hover:bg-surface-2/50 transition-colors">
                  <td colSpan={3} className="text-muted px-4 py-6 text-center">
                    No sales yet.
                  </td>
                </tr>
              ) : (
                topProducts.map((p) => (
                  <tr key={p.name} className="bg-surface hover:bg-surface-2/50 transition-colors">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-right">{p.units}</td>
                    <td className="px-4 py-3 text-right">{formatPrice(p.revenue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Promo codes</h2>
          {totalDiscount > 0 && (
            <span className="text-muted text-sm">{formatPrice(totalDiscount)} discounted</span>
          )}
        </div>
        <div className="rounded-card border-border bg-surface shadow-card overflow-hidden border">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-muted text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Code</th>
                <th className="hidden px-4 py-2 font-medium sm:table-cell">Deal</th>
                <th className="px-4 py-2 text-right font-medium">Redemptions</th>
                <th className="px-4 py-2 text-right font-medium">Discount given</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {promoRows.length === 0 ? (
                <tr className="bg-surface hover:bg-surface-2/50 transition-colors">
                  <td colSpan={4} className="text-muted px-4 py-6 text-center">
                    No promo codes redeemed yet.
                  </td>
                </tr>
              ) : (
                promoRows.map((p) => (
                  <tr key={p.code} className="bg-surface hover:bg-surface-2/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="border-primary/40 text-primary rounded border border-dashed px-1.5 py-0.5 font-mono text-xs font-medium">
                        {p.code}
                      </span>
                    </td>
                    <td className="text-muted hidden px-4 py-3 sm:table-cell">{p.title}</td>
                    <td className="px-4 py-3 text-right">{p.uses}</td>
                    <td className="px-4 py-3 text-right">{formatPrice(p.discount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
