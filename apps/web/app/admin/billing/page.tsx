import type { Metadata } from 'next';
import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import {
  activateAdSubscription,
  cancelAdSubscription,
} from '@/app/admin/ad-region-actions';
import {
  activateBrandBidRequest,
  activatePlacementRequest,
  activatePlanRequest,
  rejectBrandBidRequest,
  rejectPlanRequest,
} from '@/app/admin/billing-actions';
import { deletePlacement } from '@/app/admin/actions';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Billing requests' };

/**
 * The sales-led billing console. Every self-serve "buy" on the site lands
 * here as a PENDING record; once invoicing is arranged, one click activates
 * it. Replaces the payment-webhook automation until the PaymentCloud gateway
 * integration lands.
 */
export default async function AdminBillingPage() {
  const supabase = await createClient();

  const [{ data: planReqs }, { data: placementReqs }, { data: slotReqs }, { data: bidReqs }] =
    await Promise.all([
      supabase
        .from('dispensary_subscriptions')
        .select('dispensary_id, status, updated_at, plan:plans(name, price_cents), dispensary:dispensaries(name, slug)')
        .eq('status', 'pending'),
      supabase
        .from('placements')
        .select('id, type, notes, price_cents, created_at, scope_state, scope_city, dispensary:dispensaries(name, slug), brand:brands(name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase
        .from('ad_subscriptions')
        .select('id, price_paid, created_at, dispensary:dispensaries(name, slug), slot:ad_slots(slot_type, region:ad_regions(name))')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase
        .from('brand_ad_bids')
        .select('id, bid_cents, created_at, brand:brands(name), region:brand_ad_regions(name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ]);

  const total =
    (planReqs?.length ?? 0) +
    (placementReqs?.length ?? 0) +
    (slotReqs?.length ?? 0) +
    (bidReqs?.length ?? 0);

  const Actions = ({
    onActivate,
    onReject,
  }: {
    onActivate: () => Promise<void>;
    onReject: () => Promise<void>;
  }) => (
    <span className="inline-flex items-center gap-3">
      <form action={onActivate}>
        <button className="text-primary text-xs font-medium hover:underline">Activate</button>
      </form>
      <form action={onReject}>
        <button className="text-danger text-xs font-medium hover:underline">Reject</button>
      </form>
    </span>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <CreditCard className="text-primary h-6 w-6" /> Billing requests
        </h1>
        <p className="text-muted mt-1 text-sm">
          Every self-serve purchase lands here as a pending request. Arrange invoicing with the
          business, then activate. {total === 0 ? 'Nothing pending right now.' : `${total} pending.`}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Plan subscriptions ({planReqs?.length ?? 0})</h2>
        {(planReqs ?? []).map((r) => {
          const shop = r.dispensary as { name: string; slug: string } | null;
          const plan = r.plan as { name: string; price_cents: number } | null;
          return (
            <div
              key={r.dispensary_id}
              className="rounded-card border-border bg-surface flex items-center justify-between border p-4 text-sm"
            >
              <div>
                <Link href={`/dispensary/${shop?.slug}`} className="text-primary font-medium hover:underline">
                  {shop?.name}
                </Link>
                <span className="text-muted"> · {plan?.name} · {formatPrice(plan?.price_cents ?? 0)}/mo</span>
              </div>
              <Actions
                onActivate={activatePlanRequest.bind(null, r.dispensary_id)}
                onReject={rejectPlanRequest.bind(null, r.dispensary_id)}
              />
            </div>
          );
        })}
        {(planReqs ?? []).length === 0 && <p className="text-muted text-sm">None pending.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Placements ({placementReqs?.length ?? 0})</h2>
        {(placementReqs ?? []).map((p) => {
          const shop = p.dispensary as { name: string; slug: string } | null;
          const brand = p.brand as { name: string } | null;
          return (
            <div
              key={p.id}
              className="rounded-card border-border bg-surface flex items-center justify-between border p-4 text-sm"
            >
              <div>
                <span className="font-medium">{shop?.name ?? brand?.name}</span>
                <span className="text-muted">
                  {' '}· {p.type} · {p.scope_city ?? p.scope_state ?? 'Nationwide'} ·{' '}
                  {formatPrice(p.price_cents ?? 0)}
                </span>
                {p.notes && <p className="text-muted text-xs">{p.notes}</p>}
              </div>
              <Actions
                onActivate={activatePlacementRequest.bind(null, p.id)}
                onReject={deletePlacement.bind(null, p.id, null)}
              />
            </div>
          );
        })}
        {(placementReqs ?? []).length === 0 && <p className="text-muted text-sm">None pending.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Region ad slots ({slotReqs?.length ?? 0})</h2>
        {(slotReqs ?? []).map((s) => {
          const shop = s.dispensary as { name: string; slug: string } | null;
          const slot = s.slot as { slot_type: string; region: { name: string } | null } | null;
          return (
            <div
              key={s.id}
              className="rounded-card border-border bg-surface flex items-center justify-between border p-4 text-sm"
            >
              <div>
                <span className="font-medium">{shop?.name}</span>
                <span className="text-muted">
                  {' '}· {slot?.slot_type} · {slot?.region?.name} · {formatPrice(s.price_paid)}/mo
                </span>
                <Badge tone="muted" className="ml-2">held 7 days</Badge>
              </div>
              <Actions
                onActivate={activateAdSubscription.bind(null, s.id)}
                onReject={cancelAdSubscription.bind(null, s.id)}
              />
            </div>
          );
        })}
        {(slotReqs ?? []).length === 0 && <p className="text-muted text-sm">None pending.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Brand featured bids ({bidReqs?.length ?? 0})</h2>
        {(bidReqs ?? []).map((b) => {
          const brand = b.brand as { name: string } | null;
          const region = b.region as { name: string } | null;
          return (
            <div
              key={b.id}
              className="rounded-card border-border bg-surface flex items-center justify-between border p-4 text-sm"
            >
              <div>
                <span className="font-medium">{brand?.name}</span>
                <span className="text-muted">
                  {' '}· {region?.name} · {formatPrice(b.bid_cents)} / 2-month term
                </span>
              </div>
              <Actions
                onActivate={activateBrandBidRequest.bind(null, b.id)}
                onReject={rejectBrandBidRequest.bind(null, b.id)}
              />
            </div>
          );
        })}
        {(bidReqs ?? []).length === 0 && <p className="text-muted text-sm">None pending.</p>}
      </section>
    </div>
  );
}
