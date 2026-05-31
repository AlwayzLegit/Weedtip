import type { Metadata } from 'next';
import { type OrderItem } from '@weedtip/shared';
import { OrderStatusControl } from '@/components/dashboard/order-status-control';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/format';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Orders' };

const STATUS_TONE: Record<string, 'primary' | 'muted' | 'default'> = {
  pending: 'default',
  confirmed: 'primary',
  ready: 'primary',
  completed: 'muted',
  cancelled: 'muted',
};

export default async function DashboardOrders() {
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('dispensary_id', dispensary.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Orders</h1>

      {!orders || orders.length === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted border p-10 text-center">
          No orders yet.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const items = (o.items as OrderItem[]) ?? [];
            return (
              <div key={o.id} className="rounded-card border-border bg-surface border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {items.length} item{items.length === 1 ? '' : 's'} ·{' '}
                      {formatPrice(o.total_cents)}
                    </p>
                    <p className="text-muted text-xs">
                      {o.order_type} · {new Date(o.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[o.status] ?? 'default'}>{o.status}</Badge>
                </div>

                {items.length > 0 && (
                  <ul className="border-border text-muted mt-3 space-y-1 border-t pt-3 text-sm">
                    {items.map((it, i) => (
                      <li key={i} className="flex justify-between">
                        <span>
                          {it.quantity}× {it.name}
                        </span>
                        <span>{formatPrice(it.unit_price_cents * it.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3">
                  <OrderStatusControl orderId={o.id} status={o.status} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
