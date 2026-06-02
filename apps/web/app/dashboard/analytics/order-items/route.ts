import { type OrderItem } from '@weedtip/shared';
import { getAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Owner-scoped CSV export of order line items (Weedmaps-style "Order Items" report). */
export async function GET() {
  const { user, profile } = await getAuth();
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (profile?.role !== 'dispensary_owner' && profile?.role !== 'admin') {
    return new Response('Forbidden', { status: 403 });
  }

  const supabase = await createClient();
  const { data: dispensary } = await supabase
    .from('dispensaries')
    .select('id')
    .eq('owner_id', user.id)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (!dispensary) return new Response('No dispensary', { status: 404 });

  const { data: orders } = await supabase
    .from('orders')
    .select('id,created_at,status,items')
    .eq('dispensary_id', dispensary.id)
    .order('created_at', { ascending: false });

  const rows = ['order_id,date,status,product,quantity,unit_price,line_total'];
  for (const o of orders ?? []) {
    for (const it of (o.items as OrderItem[]) ?? []) {
      rows.push(
        [
          o.id,
          new Date(o.created_at).toISOString(),
          o.status,
          csvEscape(it.name),
          String(it.quantity),
          (it.unit_price_cents / 100).toFixed(2),
          ((it.unit_price_cents * it.quantity) / 100).toFixed(2),
        ].join(','),
      );
    }
  }

  return new Response(rows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="order-items-${dispensary.id.slice(0, 8)}.csv"`,
    },
  });
}
