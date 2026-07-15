import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { OrderItem } from '@weedtip/shared';
import { OrderStatusControl } from '@/components/dashboard/order-status-control';
import { PrintButton } from '@/components/dashboard/print-button';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/format';
import { requireOwnerDispensary } from '@/lib/owner';
import { getPlatformSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Order detail' };

const STATUS_TONE: Record<string, 'primary' | 'muted' | 'default'> = {
  pending: 'default',
  confirmed: 'primary',
  ready: 'primary',
  completed: 'muted',
  cancelled: 'muted',
};

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();
  const [{ data: order }, settings] = await Promise.all([
    supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('dispensary_id', dispensary.id)
      .maybeSingle(),
    getPlatformSettings(),
  ]);

  if (!order) notFound();

  const items = (order.items as OrderItem[]) ?? [];
  const addr = order.delivery_address as {
    street?: string;
    unit?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
  } | null;
  const placed = new Date(order.created_at).toLocaleString();

  return (
    <div className="max-w-2xl space-y-6">
      {/* Isolate the receipt when printing. */}
      <style>{`@media print {
        body * { visibility: hidden !important; }
        .receipt, .receipt * { visibility: visible !important; }
        .receipt { position: absolute; left: 0; top: 0; width: 100%; }
        .no-print { display: none !important; }
      }`}</style>

      <div className="no-print flex items-center justify-between gap-2">
        <Link href="/dashboard/orders" className="text-muted flex items-center gap-1 text-sm hover:underline">
          <ArrowLeft className="h-4 w-4" /> Orders
        </Link>
        <PrintButton />
      </div>

      <div className="receipt card space-y-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">{settings.brandName} order</h1>
            <p className="text-muted text-sm">{dispensary.name}</p>
          </div>
          <div className="text-right">
            <Badge tone={STATUS_TONE[order.status] ?? 'default'}>{order.status}</Badge>
            <p className="text-muted mt-1 text-xs">#{order.id.slice(0, 8)}</p>
          </div>
        </div>

        <div className="text-muted grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-foreground font-medium">Placed:</span> {placed}
          </div>
          <div className="capitalize">
            <span className="text-foreground font-medium">Type:</span> {order.order_type}
          </div>
          {order.payment_method && (
            <div className="capitalize">
              <span className="text-foreground font-medium">Pays by:</span> {order.payment_method}{' '}
              <span className="text-xs">(collected by the store)</span>
            </div>
          )}
          <div>
            <span className="text-foreground font-medium">Source:</span> {order.source}
          </div>
        </div>

        {order.order_type === 'delivery' && addr && (
          <div className="border-border rounded-lg border p-3 text-sm">
            <p className="mb-1 font-medium">Deliver to</p>
            <p className="text-muted">
              {addr.street}
              {addr.unit ? `, ${addr.unit}` : ''}
              <br />
              {addr.city}, {addr.state} {addr.zip}
              {addr.phone ? (
                <>
                  <br />
                  {addr.phone}
                </>
              ) : null}
            </p>
          </div>
        )}

        <div>
          <table className="w-full text-sm">
            <thead className="text-muted text-left text-xs uppercase">
              <tr>
                <th className="pb-2 font-medium">Item</th>
                <th className="pb-2 text-center font-medium">Qty</th>
                <th className="pb-2 text-right font-medium">Price</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {items.map((it, i) => (
                <tr key={i}>
                  <td className="py-2">{it.name}</td>
                  <td className="py-2 text-center">{it.quantity}</td>
                  <td className="py-2 text-right">
                    {formatPrice((it.unit_price_cents ?? 0) * it.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-border space-y-1 border-t pt-3 text-sm">
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
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatPrice(order.total_cents)}</span>
          </div>
        </div>

        {order.notes && (
          <p className="border-border text-muted border-t pt-3 text-sm">
            <span className="text-foreground font-medium">Notes:</span> {order.notes}
          </p>
        )}
      </div>

      <div className="no-print">
        <p className="text-muted mb-2 text-sm font-medium">Update status</p>
        <OrderStatusControl orderId={order.id} status={order.status} />
      </div>
    </div>
  );
}
