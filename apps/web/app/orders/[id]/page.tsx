import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { type OrderItem } from '@weedtip/shared';
import { CancelOrderButton } from '@/components/cancel-order-button';
import { ReorderButton } from '@/components/cart/reorder-button';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/format';
import { getAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Order' };

const STATUS_TONE: Record<string, 'primary' | 'muted' | 'default'> = {
  pending: 'default',
  confirmed: 'primary',
  ready: 'primary',
  completed: 'muted',
  cancelled: 'muted',
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await getAuth();
  if (!user) redirect('/sign-in');

  const supabase = await createClient();
  const { data: order } = await supabase
    .from('orders')
    .select('*, dispensary:dispensaries(name,slug,address,city,state)')
    .eq('id', id)
    .maybeSingle();

  if (!order) notFound();

  const dispensary = order.dispensary as {
    name: string;
    slug: string;
    address: string;
    city: string;
    state: string;
  } | null;
  const items = (order.items as OrderItem[]) ?? [];
  const canCancel =
    order.user_id === user.id &&
    (order.status === 'pending' || order.status === 'confirmed');

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="rounded-card border-border bg-surface border p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-primary h-6 w-6" />
            <div>
              <h1 className="text-xl font-bold">Order placed</h1>
              <p className="text-muted text-xs">
                {new Date(order.created_at).toLocaleString()} · {order.order_type}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge tone={STATUS_TONE[order.status] ?? 'default'}>{order.status}</Badge>
            {order.payment_status === 'paid' ? (
              <Badge tone="primary">Paid</Badge>
            ) : order.payment_status === 'refunded' ? (
              <Badge tone="muted">Refunded</Badge>
            ) : (
              <Badge tone="muted">
                {order.order_type === 'delivery' ? 'Pay driver at delivery' : 'Pay at pickup'}
              </Badge>
            )}
          </div>
        </div>

        {dispensary && (
          <p className="text-muted mt-4 text-sm">
            From{' '}
            <Link href={`/dispensary/${dispensary.slug}`} className="text-primary hover:underline">
              {dispensary.name}
            </Link>{' '}
            · {dispensary.address}, {dispensary.city}, {dispensary.state}
          </p>
        )}

        {order.order_type === 'delivery' && order.delivery_address ? (
          <div className="border-border mt-4 border-t pt-4 text-sm">
            <p className="font-medium">Delivering to</p>
            {(() => {
              const a = order.delivery_address as {
                street?: string;
                unit?: string;
                city?: string;
                state?: string;
                zip?: string;
                phone?: string;
              };
              return (
                <p className="text-muted mt-1">
                  {a.street}
                  {a.unit ? `, ${a.unit}` : ''}, {a.city}, {a.state} {a.zip}
                  {a.phone ? ` · ${a.phone}` : ''}
                </p>
              );
            })()}
          </div>
        ) : null}

        <ul className="border-border mt-5 space-y-2 border-t pt-4 text-sm">
          {items.map((it, i) => (
            <li key={i} className="flex justify-between">
              <span>
                {it.quantity}× {it.name}
              </span>
              <span>{formatPrice(it.unit_price_cents * it.quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="border-border mt-4 space-y-1.5 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Subtotal</span>
            <span>{formatPrice(order.subtotal_cents)}</span>
          </div>
          {order.discount_cents > 0 && (
            <div className="text-primary flex justify-between">
              <span>Discount</span>
              <span>−{formatPrice(order.discount_cents)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted">Tax</span>
            <span>{formatPrice(order.tax_cents)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatPrice(order.total_cents)}</span>
          </div>
        </div>

        {order.notes && (
          <div className="border-border mt-4 border-t pt-4 text-sm">
            <p className="font-medium">Notes</p>
            <p className="text-muted mt-1">{order.notes}</p>
          </div>
        )}

        <p className="text-muted mt-6 text-center text-xs">
          {order.payment_status === 'paid'
            ? `Paid online${order.paid_at ? ` on ${new Date(order.paid_at).toLocaleDateString()}` : ''}. Bring a valid 21+ ID for pickup.`
            : 'Payment is collected at the dispensary. Bring a valid 21+ ID for pickup.'}
        </p>
      </div>

      {dispensary && items.length > 0 && (
        <div className="mt-4 flex justify-center">
          <ReorderButton
            dispensary={{ id: order.dispensary_id, slug: dispensary.slug, name: dispensary.name }}
            items={items.map((it) => ({
              productId: it.product_id,
              name: it.name,
              priceCents: it.unit_price_cents,
              quantity: it.quantity,
            }))}
          />
        </div>
      )}

      {canCancel && (
        <div className="mt-4 flex justify-center">
          <CancelOrderButton orderId={order.id} />
        </div>
      )}

      <div className="mt-4 text-center">
        <Link href="/orders" className="text-primary text-sm hover:underline">
          View all orders
        </Link>
      </div>
    </main>
  );
}
