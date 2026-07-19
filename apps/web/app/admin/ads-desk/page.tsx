import type { Metadata } from 'next';
import Link from 'next/link';
import { AlarmClock, BellRing, Gavel, Home, Inbox } from 'lucide-react';
import {
  activateAdSubscription,
  cancelAdSubscription,
} from '@/app/admin/ad-region-actions';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/format';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { extendRenewal, houseFillRegion, offerRenewal, setAdRequestStatus } from './actions';

export const metadata: Metadata = { title: 'Ad desk · Admin' };
export const dynamic = 'force-dynamic';

const SLOT_LABEL: Record<string, string> = {
  exclusive: 'Exclusive',
  featured: 'Featured',
  premium: 'Premium',
};

function ActionButton({
  action,
  label,
  tone = 'primary',
}: {
  action: () => Promise<void>;
  label: string;
  tone?: 'primary' | 'danger' | 'muted';
}) {
  const cls =
    tone === 'primary'
      ? 'text-primary'
      : tone === 'danger'
        ? 'text-danger'
        : 'text-muted';
  return (
    <form action={action}>
      <button className={`${cls} text-xs font-medium hover:underline`}>{label}</button>
    </form>
  );
}

/**
 * The Ad desk: every advertising action lands HERE as an actionable row —
 * pending slot holds, sold-out waitlist requests, accepted renewals, expiring
 * terms needing a renewal offer, and cold-start house fills. Email is a copy;
 * this queue is the system of record.
 */
export default async function AdsDeskPage() {
  await requireAdmin();
  const supabase = await createClient();
  const service = createServiceClient();

  const soon = new Date(Date.now() + 14 * 86_400_000).toISOString();
  const [{ data: holds }, { data: requests }, { data: expiring }, { data: houseSubs }] =
    await Promise.all([
      supabase
        .from('ad_subscriptions')
        .select(
          'id, price_paid, created_at, is_house, dispensary:dispensaries(name, slug), slot:ad_slots(slot_type, region:ad_regions(name))',
        )
        .eq('status', 'pending')
        .eq('is_house', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('ad_requests')
        .select(
          'id, kind, slot_type, created_at, dispensary:dispensaries(name, slug), region:ad_regions(name)',
        )
        .eq('status', 'open')
        .order('created_at', { ascending: false }),
      supabase
        .from('ad_subscriptions')
        .select(
          'id, price_paid, ends_at, renewal_offered_at, renewal_price_cents, dispensary:dispensaries(name), slot:ad_slots(slot_type, region_id, region:ad_regions(name))',
        )
        .eq('status', 'active')
        .eq('is_house', false)
        .not('ends_at', 'is', null)
        .lt('ends_at', soon)
        .order('ends_at'),
      supabase
        .from('ad_subscriptions')
        .select('id, ends_at, dispensary:dispensaries(name), slot:ad_slots(region:ad_regions(name))')
        .eq('status', 'active')
        .eq('is_house', true)
        .order('ends_at'),
    ]);

  // Regions with open featured/premium inventory → house-fill picks, biggest
  // markets first (tier A+ → B).
  const [{ data: gapRegions }, { data: regionRows }] = await Promise.all([
    service.rpc('ad_slot_availability'),
    service.from('ad_regions').select('id, name, tier').eq('is_active', true),
  ]);
  const regionMeta = new Map((regionRows ?? []).map((r) => [r.id, r]));
  const tierRank: Record<string, number> = { A_PLUS: 0, A: 1, B_PLUS: 2, B: 3 };
  const fillable = (gapRegions ?? [])
    .filter((r) => (r.featured_open ?? 0) > 0 || (r.premium_open ?? 0) > 0)
    .map((r) => ({
      region_id: r.region_id,
      featured_open: r.featured_open,
      premium_open: r.premium_open,
      region_name: regionMeta.get(r.region_id)?.name ?? r.region_id,
      tier: regionMeta.get(r.region_id)?.tier ?? 'B',
    }))
    .filter((r) => regionMeta.has(r.region_id))
    .sort((a, b) => (tierRank[a.tier] ?? 9) - (tierRank[b.tier] ?? 9))
    .slice(0, 12);

  const total = (holds?.length ?? 0) + (requests?.length ?? 0) + (expiring?.length ?? 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Gavel className="text-primary h-6 w-6" /> Ad desk
        </h1>
        <p className="text-muted mt-1 text-sm">
          Every advertising action lands here: holds to activate, waitlists, renewals, and
          cold-start house fills. {total === 0 ? 'Queue is clear.' : `${total} items need you.`}
        </p>
      </div>

      {/* Pending holds */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold">
          <Inbox className="text-primary h-5 w-5" /> Slot holds awaiting billing (
          {holds?.length ?? 0})
        </h2>
        {(holds ?? []).map((h) => {
          const d = h.dispensary as { name: string; slug: string } | null;
          const slot = h.slot as { slot_type: string; region: { name: string } | null } | null;
          return (
            <div
              key={h.id}
              className="rounded-card border-border bg-surface flex flex-wrap items-center justify-between gap-3 border p-4 text-sm"
            >
              <div>
                <Link href={`/dispensary/${d?.slug}`} className="text-primary font-medium hover:underline">
                  {d?.name}
                </Link>
                <span className="text-muted">
                  {' '}· {SLOT_LABEL[slot?.slot_type ?? ''] ?? slot?.slot_type} ·{' '}
                  {slot?.region?.name} · {formatPrice(h.price_paid)}/mo
                </span>
                <Badge tone="muted" className="ml-2">
                  held 7 days
                </Badge>
              </div>
              <span className="flex items-center gap-3">
                <ActionButton action={activateAdSubscription.bind(null, h.id)} label="Activate" />
                <ActionButton
                  action={cancelAdSubscription.bind(null, h.id)}
                  label="Release"
                  tone="danger"
                />
              </span>
            </div>
          );
        })}
        {(holds ?? []).length === 0 && <p className="text-muted text-sm">None pending.</p>}
      </section>

      {/* Waitlist + renewal acceptances */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold">
          <BellRing className="text-primary h-5 w-5" /> Requests ({requests?.length ?? 0})
        </h2>
        {(requests ?? []).map((r) => {
          const d = r.dispensary as { name: string; slug: string } | null;
          const region = r.region as { name: string } | null;
          return (
            <div
              key={r.id}
              className="rounded-card border-border bg-surface flex flex-wrap items-center justify-between gap-3 border p-4 text-sm"
            >
              <div>
                <span className="font-medium">{d?.name}</span>
                <span className="text-muted">
                  {' '}· {SLOT_LABEL[r.slot_type] ?? r.slot_type} · {region?.name}
                </span>
                <Badge tone={r.kind === 'renewal_accept' ? 'primary' : 'muted'} className="ml-2">
                  {r.kind === 'renewal_accept' ? 'Renewal accepted' : 'Waitlist'}
                </Badge>
              </div>
              <span className="flex items-center gap-3">
                <ActionButton action={setAdRequestStatus.bind(null, r.id, 'resolved')} label="Resolve" />
                <ActionButton
                  action={setAdRequestStatus.bind(null, r.id, 'dismissed')}
                  label="Dismiss"
                  tone="muted"
                />
              </span>
            </div>
          );
        })}
        {(requests ?? []).length === 0 && <p className="text-muted text-sm">No open requests.</p>}
      </section>

      {/* Expiring terms → renewal offers */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold">
          <AlarmClock className="text-primary h-5 w-5" /> Terms ending within 14 days (
          {expiring?.length ?? 0})
        </h2>
        {(expiring ?? []).map((e) => {
          const d = e.dispensary as { name: string } | null;
          const slot = e.slot as { slot_type: string; region: { name: string } | null } | null;
          return (
            <div
              key={e.id}
              className="rounded-card border-border bg-surface flex flex-wrap items-center justify-between gap-3 border p-4 text-sm"
            >
              <div>
                <span className="font-medium">{d?.name}</span>
                <span className="text-muted">
                  {' '}· {SLOT_LABEL[slot?.slot_type ?? ''] ?? slot?.slot_type} ·{' '}
                  {slot?.region?.name} · now {formatPrice(e.price_paid)}/mo · ends{' '}
                  {e.ends_at ? new Date(e.ends_at).toLocaleDateString() : '—'}
                </span>
                {e.renewal_offered_at && (
                  <Badge tone="primary" className="ml-2">
                    Offered {formatPrice(e.renewal_price_cents ?? 0)}/mo
                  </Badge>
                )}
              </div>
              <span className="flex items-center gap-3">
                {e.renewal_offered_at ? (
                  <ActionButton
                    action={extendRenewal.bind(null, e.id)}
                    label="Extend term at offer"
                  />
                ) : (
                  <ActionButton
                    action={offerRenewal.bind(null, e.id)}
                    label="Offer renewal at current price"
                  />
                )}
              </span>
            </div>
          );
        })}
        {(expiring ?? []).length === 0 && <p className="text-muted text-sm">Nothing expiring soon.</p>}
      </section>

      {/* Cold-start house fills */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold">
          <Home className="text-primary h-5 w-5" /> House fills (cold start)
        </h2>
        <p className="text-muted text-sm">
          Comp a region&apos;s best photo-backed shops into its open featured/premium slots — $0,
          30-day term, shown as &ldquo;Featured&rdquo; (never &ldquo;Sponsored&rdquo;). A real
          buyer automatically preempts a house fill. {houseSubs?.length ?? 0} live house
          placement{(houseSubs?.length ?? 0) === 1 ? '' : 's'}.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {fillable.map((r) => (
            <div
              key={r.region_id}
              className="rounded-card border-border bg-surface flex items-center justify-between gap-3 border p-3 text-sm"
            >
              <span>
                <span className="font-medium">{r.region_name}</span>
                <span className="text-muted">
                  {' '}· {r.featured_open ?? 0} featured / {r.premium_open ?? 0} premium open
                </span>
              </span>
              <ActionButton action={houseFillRegion.bind(null, r.region_id)} label="Fill with house picks" />
            </div>
          ))}
        </div>
        {fillable.length === 0 && (
          <p className="text-muted text-sm">No regions with open inventory (or availability data).</p>
        )}
      </section>
    </div>
  );
}
