import type { Metadata } from 'next';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { type OrderItem, type OrderStatus } from '@weedtip/shared';
import type { Tables } from '@weedtip/supabase/types';
import { AcceptingOrdersToggle } from '@/components/dashboard/accepting-orders-toggle';
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
  { status: 'out_for_delivery', label: 'Out for delivery' },
];

const STATUS_TONE: Record<string, 'primary' | 'muted' | 'default'> = {
  pending: 'default',
  confirmed: 'primary',
  ready: 'primary',
  out_for_delivery: 'primary',
  completed: 'muted',
  cancelled: 'muted',
};

function OrderCard({ o }: { o: Order }) {
  const items = (o.items as OrderItem[]) ?? [];
  return (
    <div className="rounded-card border-border bg-surface border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{formatPrice(o.total_cents)}</span>
        <span className="text-muted text-xs capitalize">
          {o.order_type}
          {/* Shopper's declared pay method — collected by the store, not Weedtip. */}
          {o.payment_method === 'cash' || o.payment_method === 'debit'
            ? ` · ${o.payment_method}`
            : ''}
        </span>
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
      {o.order_type === 'delivery' && o.delivery_address ? (
        <p className="border-border text-muted mt-2 border-t pt-2 text-xs">
          <span className="text-foreground font-medium">Deliver to: </span>
          {(() => {
            const a = o.delivery_address as {
              street?: string;
              unit?: string;
              city?: string;
              zip?: string;
              phone?: string;
            };
            return `${a.street ?? ''}${a.unit ? `, ${a.unit}` : ''}, ${a.city ?? ''} ${a.zip ?? ''}${a.phone ? ` · ${a.phone}` : ''}`;
          })()}
        </p>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-2">
        <OrderStatusControl orderId={o.id} status={o.status} orderType={o.order_type} />
        <Link
          href={`/dashboard/orders/${o.id}`}
          className="text-primary -my-2 -mr-2 shrink-0 px-2 py-2 text-xs font-medium hover:underline"
        >
          Details →
        </Link>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Orders</h1>
        <div className="flex items-center gap-3">
          <AcceptingOrdersToggle accepting={dispensary.accepting_orders} />
          {all.length > 0 && (
            <a href="/dashboard/orders/export" download>
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            </a>
          )}
        </div>
      </div>

      {!dispensary.accepting_orders && (
        <div className="rounded-card border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700">
          Online ordering is paused — shoppers can’t place new orders until you resume.
        </div>
      )}

      {all.length === 0 ? (
        <div className="rounded-card border-border bg-surface border p-10 text-center">
          <p className="text-foreground font-medium">No orders yet</p>
          <p className="text-muted mt-1 text-sm">
            Build out your menu and share your page to bring in your first order.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Link href="/dashboard/products/new">
              <Button size="sm">Add products</Button>
            </Link>
            <Link href={`/dispensary/${dispensary.slug}`}>
              <Button size="sm" variant="outline">
                View public page
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              <div className="rounded-card border-border bg-surface shadow-card overflow-hidden border">
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
