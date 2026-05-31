import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getOwnerContext } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Dashboard' };

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-card border-border bg-surface border p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-muted text-sm">{label}</p>
    </div>
  );
}

export default async function DashboardOverview() {
  // Resolves the owner + their dispensary, redirecting non-owners cleanly.
  const { dispensary } = await getOwnerContext();
  const supabase = await createClient();

  if (!dispensary) {
    return (
      <div className="rounded-card border-border bg-surface border p-10 text-center">
        <h1 className="text-xl font-bold">Welcome to Weedtip</h1>
        <p className="text-muted mx-auto mt-2 max-w-md">
          You don&apos;t have a dispensary listing yet. Listings start in{' '}
          <Badge tone="muted">pending</Badge> and go live once approved by an admin.
        </p>
        <Link href="/dashboard/listing" className="mt-6 inline-block">
          <Button size="lg">Create your listing</Button>
        </Link>
      </div>
    );
  }

  const nowIso = new Date().toISOString();
  const [{ count: productCount }, { count: dealCount }, { data: orders }, { data: reviews }] =
    await Promise.all([
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('dispensary_id', dispensary.id),
      supabase
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('dispensary_id', dispensary.id)
        .eq('is_active', true)
        .lte('start_date', nowIso)
        .gte('end_date', nowIso),
      supabase.from('orders').select('status').eq('dispensary_id', dispensary.id),
      supabase.from('reviews').select('rating').eq('dispensary_id', dispensary.id),
    ]);

  const pendingOrders = (orders ?? []).filter((o) => o.status === 'pending').length;
  const avgRating = reviews?.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{dispensary.name}</h1>
          <p className="text-muted text-sm">
            Status:{' '}
            <Badge tone={dispensary.status === 'active' ? 'primary' : 'muted'}>
              {dispensary.status}
            </Badge>
          </p>
        </div>
        <Link href={`/dispensary/${dispensary.slug}`} target="_blank">
          <Button variant="outline" size="sm">
            View public page <ExternalLink className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Products" value={productCount ?? 0} />
        <Stat label="Active deals" value={dealCount ?? 0} />
        <Stat label="Pending orders" value={pendingOrders} />
        <Stat label="Avg rating" value={avgRating} />
      </div>

      <div className="rounded-card border-border bg-surface border p-6">
        <h2 className="text-lg font-semibold">Quick actions</h2>
        <p className="text-muted mt-1 text-sm">Manage your menu, deals, and orders.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/dashboard/products/new">
            <Button size="sm">Add product</Button>
          </Link>
          <Link href="/dashboard/deals/new">
            <Button variant="outline" size="sm">
              Create deal
            </Button>
          </Link>
          <Link href="/dashboard/orders">
            <Button variant="outline" size="sm">
              View orders
            </Button>
          </Link>
          <Link href="/dashboard/listing">
            <Button variant="outline" size="sm">
              Edit listing
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
