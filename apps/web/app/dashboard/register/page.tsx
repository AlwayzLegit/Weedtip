import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, Calculator, DollarSign, Receipt } from 'lucide-react';
import { PosAddonButton } from '@/components/dashboard/pos-addon-button';
import { RegisterTerminal } from '@/components/dashboard/register-terminal';
import { ShiftBar } from '@/components/dashboard/shift-bar';
import { formatPrice } from '@/lib/format';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Register (POS)' };

const LOW_STOCK_THRESHOLD = 5;

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const { dispensary, role } = await requireOwnerDispensary();
  const { billing } = await searchParams;
  const posEnabled = dispensary.pos_addon || role === 'admin';

  if (!posEnabled) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Register</h1>
        {billing === 'pos' && (
          <p className="border-primary/40 bg-primary-muted text-primary rounded-card border px-4 py-2 text-sm">
            Payment received — your POS add-on activates momentarily. Refresh in a few seconds.
          </p>
        )}
        {billing === 'cancel' && (
          <p className="border-border bg-surface text-muted rounded-card border px-4 py-2 text-sm">
            Checkout canceled. No charge was made.
          </p>
        )}
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <Calculator className="text-primary h-8 w-8" />
          <p className="text-lg font-semibold">POS is a paid add-on</p>
          <p className="text-muted max-w-md text-sm">
            Ring up in-store sales right from your dashboard — sales post to your orders and
            analytics with no platform commission, and draw down inventory. The register isn&apos;t
            enabled for {dispensary.name} yet.
          </p>
          <PosAddonButton />
          <Link href="/dashboard/promote" className="text-primary text-sm hover:underline">
            See all plans &amp; add-ons →
          </Link>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const todayIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const [
    { data: products },
    { data: lowStock },
    { data: todaySales },
    openShiftRes,
    recentShiftsRes,
  ] = await Promise.all([
    supabase
      .from('products')
      .select('id,name,price_cents,stock_qty, category:categories(name)')
      .eq('dispensary_id', dispensary.id)
      .eq('in_stock', true)
      .order('name')
      .limit(1000),
    supabase
      .from('products')
      .select('id,name,stock_qty')
      .eq('dispensary_id', dispensary.id)
      .not('stock_qty', 'is', null)
      .lte('stock_qty', LOW_STOCK_THRESHOLD)
      .order('stock_qty')
      .limit(20),
    supabase
      .from('orders')
      .select('total_cents')
      .eq('dispensary_id', dispensary.id)
      .eq('source', 'pos')
      .gte('created_at', todayIso),
    supabase
      .from('pos_shifts')
      .select('id,opened_at,opening_float_cents')
      .eq('dispensary_id', dispensary.id)
      .is('closed_at', null)
      .maybeSingle(),
    supabase
      .from('pos_shifts')
      .select(
        'id,opened_at,closed_at,opening_float_cents,closing_count_cents,expected_cash_cents,cash_sales_cents,card_sales_cents,debit_sales_cents,sales_count,over_short_cents',
      )
      .eq('dispensary_id', dispensary.id)
      .not('closed_at', 'is', null)
      .order('opened_at', { ascending: false })
      .limit(8),
  ]);
  const openShift = openShiftRes.data;
  const recentShifts = recentShiftsRes.data ?? [];

  // Live cash-drawer tally for the open shift.
  const live = { cash: 0, card: 0, debit: 0, count: 0 };
  if (openShift) {
    const { data: shiftSales } = await supabase
      .from('orders')
      .select('payment_method,total_cents')
      .eq('dispensary_id', dispensary.id)
      .eq('source', 'pos')
      .gte('created_at', openShift.opened_at);
    for (const o of shiftSales ?? []) {
      live.count += 1;
      if (o.payment_method === 'cash') live.cash += o.total_cents;
      else if (o.payment_method === 'card') live.card += o.total_cents;
      else if (o.payment_method === 'debit') live.debit += o.total_cents;
    }
  }

  const items = (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    price_cents: p.price_cents,
    stock_qty: p.stock_qty,
    category: (p.category as { name: string } | null)?.name ?? null,
  }));

  const todayCount = todaySales?.length ?? 0;
  const todayTotal = (todaySales ?? []).reduce((s, o) => s + o.total_cents, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Register</h1>
        <p className="text-muted mt-1 text-sm">
          Ring up in-store sales for {dispensary.name}. Sales post to your orders and analytics
          with no platform commission, and draw down tracked inventory.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card flex items-center gap-3 p-4">
          <Receipt className="text-primary h-5 w-5" />
          <div>
            <p className="text-xl font-bold">{todayCount}</p>
            <p className="text-muted text-xs">POS sales today</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <DollarSign className="text-primary h-5 w-5" />
          <div>
            <p className="text-xl font-bold">{formatPrice(todayTotal)}</p>
            <p className="text-muted text-xs">In-store revenue today</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <AlertTriangle
            className={lowStock && lowStock.length > 0 ? 'text-danger h-5 w-5' : 'text-muted h-5 w-5'}
          />
          <div>
            <p className="text-xl font-bold">{lowStock?.length ?? 0}</p>
            <p className="text-muted text-xs">Low / out of stock</p>
          </div>
        </div>
      </div>

      {lowStock && lowStock.length > 0 && (
        <div className="rounded-card border-border bg-surface border p-4">
          <h2 className="mb-2 text-sm font-semibold">Low stock</h2>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/products/${p.id}`}
                className="border-border bg-surface-2 hover:border-primary/50 rounded-full border px-3 py-1 text-xs transition-colors"
              >
                {p.name} · <span className="text-danger font-medium">{p.stock_qty}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <ShiftBar shift={openShift} live={live} />

      <RegisterTerminal products={items} />

      {recentShifts.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Recent shifts</h2>
          <div className="rounded-card border-border bg-surface overflow-x-auto border">
            <table className="w-full text-sm">
              <thead className="text-muted border-border border-b text-left text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 font-medium">Opened</th>
                  <th className="px-3 py-2 font-medium">Sales</th>
                  <th className="px-3 py-2 font-medium">Cash / Card / Debit</th>
                  <th className="px-3 py-2 font-medium">Expected</th>
                  <th className="px-3 py-2 font-medium">Counted</th>
                  <th className="px-3 py-2 font-medium">Over / Short</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {recentShifts.map((s) => {
                  const os = s.over_short_cents ?? 0;
                  return (
                    <tr key={s.id}>
                      <td className="px-3 py-2">
                        {new Date(s.opened_at).toLocaleDateString()}{' '}
                        <span className="text-muted">
                          {new Date(s.opened_at).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>
                      <td className="px-3 py-2">{s.sales_count}</td>
                      <td className="px-3 py-2">
                        {formatPrice(s.cash_sales_cents)} / {formatPrice(s.card_sales_cents)} /{' '}
                        {formatPrice(s.debit_sales_cents)}
                      </td>
                      <td className="px-3 py-2">{formatPrice(s.expected_cash_cents ?? 0)}</td>
                      <td className="px-3 py-2">{formatPrice(s.closing_count_cents ?? 0)}</td>
                      <td
                        className={
                          os === 0
                            ? 'px-3 py-2'
                            : os > 0
                              ? 'text-primary px-3 py-2'
                              : 'text-danger px-3 py-2'
                        }
                      >
                        {os > 0 ? '+' : ''}
                        {formatPrice(os)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
