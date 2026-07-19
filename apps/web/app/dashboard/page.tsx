import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink, Megaphone } from 'lucide-react';
import { getSlotAvailability, resolveGeo } from '@/lib/ad-serving';
import { formatPrice as fmtPrice } from '@/lib/format';
import { promotionGate } from '@/lib/promotion-gate';
import { SetupChecklist } from '@/components/dashboard/setup-checklist';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import { setupSteps } from '@/lib/onboarding';
import { getOwnerContext } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Dashboard' };

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="card sheen p-5">
      <p className={`text-2xl font-bold tracking-tight ${accent ? 'text-primary' : ''}`}>{value}</p>
      <p className="text-muted mt-0.5 text-sm">{label}</p>
    </div>
  );
}

export default async function DashboardOverview() {
  // Resolves the owner + their dispensary, redirecting non-owners cleanly.
  const { dispensary } = await getOwnerContext();
  const supabase = await createClient();

  if (!dispensary) {
    return (
      <div className="card p-10 text-center">
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
      supabase
        .from('orders')
        .select('id,status,total_cents,created_at')
        .eq('dispensary_id', dispensary.id)
        .order('created_at', { ascending: false }),
      supabase.from('reviews').select('rating').eq('dispensary_id', dispensary.id),
    ]);

  const orderList = orders ?? [];
  const pendingOrders = orderList.filter((o) => o.status === 'pending').length;
  const revenue = orderList
    .filter((o) => o.status !== 'cancelled')
    .reduce((s, o) => s + o.total_cents, 0);
  const recentOrders = orderList.slice(0, 5);
  const avgRating = reviews?.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—';

  const steps = setupSteps(dispensary, {
    products: productCount ?? 0,
    deals: dealCount ?? 0,
  });

  // The shop's ad region: open spots + today's step price + the tiered-setup
  // unlock state — owners should SEE their market's inventory from day one.
  const gate = await promotionGate(dispensary.id);
  let adRegion: {
    name: string;
    slug: string;
    featuredOpen: number;
    premiumOpen: number;
    featuredPrice: number | null;
  } | null = null;
  if (typeof dispensary.latitude === 'number' && typeof dispensary.longitude === 'number') {
    const geo = await resolveGeo(dispensary.longitude, dispensary.latitude);
    if (geo) {
      const [availability, { data: price }] = await Promise.all([
        getSlotAvailability(),
        supabase.rpc('slot_price_cents', {
          p_region_id: geo.regionId,
          p_slot_type: 'featured',
        }),
      ]);
      // Only render the card when the region actually has seeded inventory —
      // defaulting to "3 of 3 / 10 of 10 open" would advertise spots that
      // don't exist and dead-end the CTA.
      const a = availability.get(geo.regionId);
      if (a) {
        adRegion = {
          name: geo.regionName,
          slug: geo.regionSlug,
          featuredOpen: a.featuredOpen,
          premiumOpen: a.premiumOpen,
          featuredPrice: typeof price === 'number' ? price : null,
        };
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Dashboard</p>
          <h1 className="text-2xl font-bold sm:text-3xl">{dispensary.name}</h1>
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

      {/* Guided first-run activation — the fastest path to a live, sellable page. */}
      <SetupChecklist steps={steps} />

      {/* Their market's ad inventory, front and center (tiered-setup aware). */}
      {adRegion && (
        <div className="rounded-card border-primary/30 bg-primary-subtle flex flex-wrap items-center justify-between gap-3 border p-5">
          <div>
            <p className="flex items-center gap-1.5 font-semibold">
              <Megaphone className="text-primary h-4 w-4" /> Your area: {adRegion.name}
            </p>
            <p className="text-muted mt-0.5 text-sm">
              {adRegion.featuredOpen > 0 || adRegion.premiumOpen > 0 ? (
                <>
                  {adRegion.featuredOpen} of 3 featured and {adRegion.premiumOpen} of 10 premium
                  spots open
                  {adRegion.featuredPrice != null &&
                    ` — featured from ${fmtPrice(adRegion.featuredPrice)}/mo`}
                  . Each spot sold raises the next spot&apos;s price.
                </>
              ) : (
                <>All sponsored spots are taken — join the waitlist for the next opening.</>
              )}
              {!gate.unlocked && (
                <span className="block">
                  Unlock advertising by finishing setup: {gate.missing.join(' · ')}.
                </span>
              )}
            </p>
          </div>
          <Link href={`/advertise/${adRegion.slug}`}>
            <Button size="sm" variant={gate.unlocked ? 'primary' : 'outline'}>
              {gate.unlocked ? 'See placements' : 'Preview placements'}
            </Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Revenue" value={formatPrice(revenue)} accent />
        <Stat label="Products" value={productCount ?? 0} />
        <Stat label="Active deals" value={dealCount ?? 0} />
        <Stat label="Pending orders" value={pendingOrders} />
        <Stat label="Avg rating" value={avgRating} />
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent orders</h2>
          <Link href="/dashboard/orders" className="text-primary text-sm hover:underline">
            View all
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-muted mt-2 text-sm">No orders yet.</p>
        ) : (
          <ul className="divide-border mt-3 divide-y">
            {recentOrders.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted">{new Date(o.created_at).toLocaleDateString()}</span>
                <span className="flex items-center gap-3">
                  <span className="font-medium">{formatPrice(o.total_cents)}</span>
                  <Badge tone={o.status === 'completed' || o.status === 'cancelled' ? 'muted' : 'primary'}>
                    {o.status}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-6">
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
          <Link href="/dashboard/analytics">
            <Button variant="outline" size="sm">
              Analytics
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
