import type { Metadata } from 'next';
import { Download } from 'lucide-react';
import { type OrderItem, type OrderStatus } from '@weedtip/shared';
import type { Tables } from '@weedtip/supabase/types';
import { OrderStatusControl } from '@/components/dashboard/order-status-control';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Orders' };

type Order = Tables<'orders'>;

// Active fulfillment lanes, in pipeline order.
const LANES: { status: OrderStatus; label: string }[] = [
  { status: 'pending', label: 'New' },
  { status: 'confirmed', label: 'Preparing' },
  { status: 'ready', label: 'Ready' },
];

const STATUS_TONE: Record<string, 'primary' | 'muted' | 'default'> = {
  pending: 'default',
  confirmed: 'primary',
  ready: 'primary',
  completed: 'muted',
  cancelled: 'muted',
};

function OrderCard({ o }: { o: Order }) {
  const items = (o.items as OrderItem[]) ?? [];
  return (
    <div className="rounded-card border-border bg-surface border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{formatPrice(o.total_cents)}</span>
        <span className="text-muted text-xs capitalize">{o.order_type}</span>
      </div>
      <p className="text-muted mt-0.5 text-xs">
        {new Date(o.created_at).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}
      </p>
      {items.length > 0 && (
        <ul className="text-muted mt-2 space-y-0.5 text-xs">
          {items.slice(0, 4).map((it, i) => (
            <li key={i}>
              {it.quantity}× {it.name}
            </li>
          ))}
          {items.length > 4 && <li>+{items.length - 4} more…</li>}
        </ul>
      )}
      <div className="mt-3">
        <OrderStatusControl orderId={o.id} status={o.status} />
      </div>
    </div>
  );
}

export default async function DashboardOrders() {
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('dispensary_id', dispensary.id)
    .order('created_at', { ascending: false });

  const all = orders ?? [];
  const byStatus = (s: OrderStatus) => all.filter((o) => o.status === s);
  // Recently closed orders (completed or cancelled), most recent first.
  const closed = all
    .filter((o) => o.status === 'completed' || o.status === 'cancelled')
    .slice(0, 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Orders</h1>
        {all.length > 0 && (
          <a href="/dashboard/orders/export" download>
            <Button size="sm" variant="outline">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </a>
        )}
      </div>

      {all.length === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted border p-10 text-center">
          No orders yet.
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {LANES.map((lane) => {
              const laneOrders = byStatus(lane.status);
              return (
                <div key={lane.status} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold">{lane.label}</h2>
                    <Badge tone={STATUS_TONE[lane.status]}>{laneOrders.length}</Badge>
                  </div>
                  {laneOrders.length === 0 ? (
                    <p className="border-border text-muted rounded-card border border-dashed p-4 text-center text-xs">
                      Nothing here
                    </p>
                  ) : (
                    laneOrders.map((o) => <OrderCard key={o.id} o={o} />)
                  )}
                </div>
              );
            })}
          </div>

          {closed.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-muted text-sm font-semibold uppercase tracking-wide">
                Recently closed
              </h2>
              <div className="rounded-card border-border overflow-hidden border">
                <table className="w-full text-sm">
                  <thead className="bg-surface-2 text-muted text-left">
                    <tr>
                      <th className="px-4 py-2 font-medium">Date</th>
                      <th className="hidden px-4 py-2 font-medium sm:table-cell">Type</th>
                      <th className="px-4 py-2 font-medium">Total</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {closed.map((o) => (
                      <tr key={o.id} className="bg-surface">
                        <td className="px-4 py-2">{new Date(o.created_at).toLocaleDateString()}</td>
                        <td className="text-muted hidden px-4 py-2 capitalize sm:table-cell">
                          {o.order_type}
                        </td>
                        <td className="px-4 py-2">{formatPrice(o.total_cents)}</td>
                        <td className="px-4 py-2">
                          <Badge tone={STATUS_TONE[o.status] ?? 'default'}>{o.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
