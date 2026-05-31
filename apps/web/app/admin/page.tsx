import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Admin' };

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border-border bg-surface border p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-muted text-sm">{label}</p>
    </div>
  );
}

export default async function AdminOverview() {
  const supabase = await createClient();
  const head = { count: 'exact' as const, head: true };

  const [pending, active, suspended, products, orders, users] = await Promise.all([
    supabase.from('dispensaries').select('id', head).eq('status', 'pending'),
    supabase.from('dispensaries').select('id', head).eq('status', 'active'),
    supabase.from('dispensaries').select('id', head).eq('status', 'suspended'),
    supabase.from('products').select('id', head),
    supabase.from('orders').select('id', head),
    supabase.from('profiles').select('id', head),
  ]);

  const pendingCount = pending.count ?? 0;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Overview</h2>

      {pendingCount > 0 && (
        <div className="rounded-card border-warning/40 bg-warning/10 flex items-center justify-between border p-4">
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="text-warning h-5 w-5" />
            <span>
              <strong>{pendingCount}</strong> dispensary listing{pendingCount === 1 ? '' : 's'}{' '}
              awaiting approval.
            </span>
          </div>
          <Link href="/admin/dispensaries?status=pending">
            <Button size="sm">Review</Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Pending listings" value={pendingCount} />
        <Stat label="Active listings" value={active.count ?? 0} />
        <Stat label="Suspended" value={suspended.count ?? 0} />
        <Stat label="Products" value={products.count ?? 0} />
        <Stat label="Orders" value={orders.count ?? 0} />
        <Stat label="Users" value={users.count ?? 0} />
      </div>
    </div>
  );
}
