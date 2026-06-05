import { type OrderItem } from '@weedtip/shared';
import { getAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Owner-scoped CSV export of orders (one row per order) — Weedmaps-style Orders report. */
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
    .select(
      'id,created_at,status,order_type,payment_status,source,device,items,subtotal_cents,tax_cents,total_cents',
    )
    .eq('dispensary_id', dispensary.id)
    .order('created_at', { ascending: false });

  const rows = [
    'order_id,date,status,type,payment_status,source,device,item_count,subtotal,tax,total',
  ];
  for (const o of orders ?? []) {
    const items = (o.items as OrderItem[]) ?? [];
    const itemCount = items.reduce((s, it) => s + it.quantity, 0);
    rows.push(
      [
        o.id,
        new Date(o.created_at).toISOString(),
        o.status,
        o.order_type,
        o.payment_status,
        o.source ?? 'web',
        o.device ?? '',
        String(itemCount),
        (o.subtotal_cents / 100).toFixed(2),
        (o.tax_cents / 100).toFixed(2),
        (o.total_cents / 100).toFixed(2),
      ]
        .map(csvEscape)
        .join(','),
    );
  }

  return new Response(rows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders-${dispensary.id.slice(0, 8)}.csv"`,
    },
  });
}
