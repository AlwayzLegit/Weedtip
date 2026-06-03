import type { Metadata } from 'next';
import Link from 'next/link';
import { ORDER_STATUSES, type OrderItem } from '@weedtip/shared';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Orders · Admin' };

const STATUS_TONE: Record<string, 'primary' | 'muted' | 'default'> = {
  pending: 'default',
  confirmed: 'primary',
  ready: 'primary',
  completed: 'muted',
  cancelled: 'muted',
};

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = ORDER_STATUSES.includes(status as never) ? status : undefined;

  const supabase = await createClient();
  let query = supabase
    .from('orders')
    .select('*, dispensary:dispensaries(name)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (active) query = query.eq('status', active as never);
  const { data: orders } = await query;

  const list = orders ?? [];
  const live = list.filter((o) => o.status !== 'cancelled');
  const gmv = live.reduce((s, o) => s + o.total_cents, 0);
  const commission = list
    .filter((o) => o.payment_status === 'paid')
    .reduce((s, o) => s + (o.platform_fee_cents ?? 0), 0);

  const filters = [
    { key: undefined, label: 'All' },
    ...ORDER_STATUSES.map((s) => ({ key: s, label: s })),
  ];

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow mb-1">Operations</p>
        <h2 className="text-2xl font-bold">Orders</h2>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card sheen p-4">
          <p className="text-xl font-bold">{list.length}</p>
          <p className="text-muted text-xs">orders {active ? `(${active})` : '(latest 100)'}</p>
        </div>
        <div className="card sheen p-4">
          <p className="text-primary text-xl font-bold">{formatPrice(gmv)}</p>
          <p className="text-muted text-xs">GMV (non-cancelled)</p>
        </div>
        <div className="card sheen p-4">
          <p className="text-xl font-bold">{formatPrice(commission)}</p>
          <p className="text-muted text-xs">commission (paid)</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.label}
            href={f.key ? `/admin/orders?status=${f.key}` : '/admin/orders'}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-medium capitalize transition-colors',
              active === f.key
                ? 'border-primary bg-primary-muted text-primary'
                : 'border-border text-muted hover:text-foreground',
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="card text-muted p-10 text-center">
          No orders{active ? ` with status “${active}”` : ' across the platform yet'}.
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((o) => {
            const dispensary = o.dispensary as { name: string } | null;
            const items = (o.items as OrderItem[]) ?? [];
            return (
              <div
                key={o.id}
                className="rounded-card border-border bg-surface shadow-card hover:border-border-strong flex items-center justify-between border p-4 transition-colors"
              >
                <div>
                  <p className="font-medium">{dispensary?.name ?? 'Dispensary'}</p>
                  <p className="text-muted text-xs">
                    {items.length} item{items.length === 1 ? '' : 's'} · {o.order_type} ·{' '}
                    {new Date(o.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {o.payment_status === 'paid' && <Badge tone="outline">paid</Badge>}
                  <span className="font-medium">{formatPrice(o.total_cents)}</span>
                  <Badge tone={STATUS_TONE[o.status] ?? 'default'}>{o.status}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
