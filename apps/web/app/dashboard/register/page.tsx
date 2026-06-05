import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, DollarSign, Receipt } from 'lucide-react';
import { RegisterTerminal } from '@/components/dashboard/register-terminal';
import { formatPrice } from '@/lib/format';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Register (POS)' };

const LOW_STOCK_THRESHOLD = 5;

export default async function RegisterPage() {
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();
  const todayIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const [{ data: products }, { data: lowStock }, { data: todaySales }, { data: sub }] =
    await Promise.all([
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
        .from('dispensary_subscriptions')
        .select('status, plan:plans(price_cents)')
        .eq('dispensary_id', dispensary.id)
        .maybeSingle(),
    ]);

  const items = (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    price_cents: p.price_cents,
    stock_qty: p.stock_qty,
    category: (p.category as { name: string } | null)?.name ?? null,
  }));

  const todayCount = todaySales?.length ?? 0;
  const todayTotal = (todaySales ?? []).reduce((s, o) => s + o.total_cents, 0);
  const planPrice = (sub?.plan as { price_cents: number } | null)?.price_cents ?? 0;
  const onPaidPlan = sub?.status === 'active' && planPrice > 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Register</h1>
        <p className="text-muted mt-1 text-sm">
          Ring up in-store sales for {dispensary.name}. Sales post to your orders and analytics
          with no platform commission, and draw down tracked inventory.
        </p>
      </div>

      {!onPaidPlan && (
        <div className="rounded-card border-primary/40 bg-primary-muted flex flex-wrap items-center justify-between gap-2 border px-4 py-3 text-sm">
          <span>
            <strong>POS is a paid add-on.</strong> You&apos;re on the Free plan — upgrade to unlock
            the register for daily use.
          </span>
          <Link href="/dashboard/promote" className="text-primary font-medium hover:underline">
            See plans →
          </Link>
        </div>
      )}

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
          <AlertTriangle className={lowStock && lowStock.length > 0 ? 'text-danger h-5 w-5' : 'text-muted h-5 w-5'} />
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

      <RegisterTerminal products={items} />
    </div>
  );
}
