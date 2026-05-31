import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { type OrderItem } from '@weedtip/shared';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/format';
import { getAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'My orders' };

const STATUS_TONE: Record<string, 'primary' | 'muted' | 'default'> = {
  pending: 'default',
  confirmed: 'primary',
  ready: 'primary',
  completed: 'muted',
  cancelled: 'muted',
};

export default async function OrdersPage() {
  const { user } = await getAuth();
  if (!user) redirect('/sign-in');

  const supabase = await createClient();
  const { data: orders } = await supabase
    .from('orders')
    .select('*, dispensary:dispensaries(name,slug)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">My orders</h1>

      {!orders || orders.length === 0 ? (
        <div className="rounded-card border-border bg-surface border p-10 text-center">
          <p className="font-medium">No orders yet</p>
          <Link
            href="/dispensaries"
            className="text-primary mt-3 inline-block text-sm hover:underline"
          >
            Find a dispensary
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const dispensary = o.dispensary as { name: string; slug: string } | null;
            const items = (o.items as OrderItem[]) ?? [];
            return (
              <Link
                key={o.id}
                href={`/orders/${o.id}`}
                className="rounded-card border-border bg-surface hover:border-primary/50 flex items-center justify-between border p-4 transition-colors"
              >
                <div>
                  <p className="font-medium">{dispensary?.name ?? 'Dispensary'}</p>
                  <p className="text-muted text-xs">
                    {items.length} item{items.length === 1 ? '' : 's'} ·{' '}
                    {new Date(o.created_at).toLocaleDateString()} · {o.order_type}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{formatPrice(o.total_cents)}</span>
                  <Badge tone={STATUS_TONE[o.status] ?? 'default'}>{o.status}</Badge>
                  <ChevronRight className="text-muted h-4 w-4" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
