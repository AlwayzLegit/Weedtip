import type { Metadata } from 'next';
import { RegisterTerminal } from '@/components/dashboard/register-terminal';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Register (POS)' };

export default async function RegisterPage() {
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();
  const { data: products } = await supabase
    .from('products')
    .select('id,name,price_cents,stock_qty, category:categories(name)')
    .eq('dispensary_id', dispensary.id)
    .eq('in_stock', true)
    .order('name')
    .limit(1000);

  const items = (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    price_cents: p.price_cents,
    stock_qty: p.stock_qty,
    category: (p.category as { name: string } | null)?.name ?? null,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Register</h1>
        <p className="text-muted mt-1 text-sm">
          Ring up in-store sales for {dispensary.name}. Sales post to your orders and analytics
          with no platform commission, and draw down tracked inventory.
        </p>
      </div>
      <RegisterTerminal products={items} />
    </div>
  );
}
