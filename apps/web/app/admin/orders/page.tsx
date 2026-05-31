import type { Metadata } from 'next';
import { type OrderItem } from '@weedtip/shared';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Orders · Admin' };

const STATUS_TONE: Record<string, 'primary' | 'muted' | 'default'> = {
  pending: 'default',
  confirmed: 'primary',
  ready: 'primary',
  completed: 'muted',
  cancelled: 'muted',
};

export default async function AdminOrders() {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from('orders')
    .select('*, dispensary:dispensaries(name)')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Orders</h2>
      {!orders || orders.length === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted border p-10 text-center">
          No orders across the platform yet.
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => {
            const dispensary = o.dispensary as { name: string } | null;
            const items = (o.items as OrderItem[]) ?? [];
            return (
              <div
                key={o.id}
                className="rounded-card border-border bg-surface flex items-center justify-between border p-4"
              >
                <div>
                  <p className="font-medium">{dispensary?.name ?? 'Dispensary'}</p>
                  <p className="text-muted text-xs">
                    {items.length} item{items.length === 1 ? '' : 's'} · {o.order_type} ·{' '}
                    {new Date(o.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
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
