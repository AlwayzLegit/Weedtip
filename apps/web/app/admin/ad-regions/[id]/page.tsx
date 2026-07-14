import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Crown } from 'lucide-react';
import {
  activateAdSubscription,
  cancelAdSubscription,
  deleteAdZone,
} from '@/app/admin/ad-region-actions';
import {
  AdBoundaryForm,
  AdRegionForm,
  AdZoneForm,
  CompSlotForm,
} from '@/components/admin/ad-region-forms';
import { DeleteButton } from '@/components/dashboard/delete-button';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Ad region' };

const TIER_LABEL: Record<string, string> = { A_PLUS: 'A+', A: 'A', B_PLUS: 'B+', B: 'B' };
const SLOT_ORDER: Record<string, number> = { exclusive: 0, featured: 1, premium: 2 };

export default async function AdRegionAdminDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: region } = await supabase
    .from('ad_regions')
    .select(
      'id,market_id,slug,name,tier,exclusive_price_min,exclusive_price_max,is_active,sort_order',
    )
    .eq('id', id)
    .maybeSingle();
  if (!region) notFound();

  const [{ data: zones }, { data: slots }, { data: subs }] = await Promise.all([
    supabase.from('ad_zones').select('id,slug,name').eq('region_id', id).order('name'),
    supabase.from('ad_slots').select('id,slot_type,position').eq('region_id', id),
    supabase
      .from('ad_subscriptions')
      .select('id,slot_id,status,price_paid,starts_at,dispensary:dispensaries(name,slug)')
      .in('status', ['pending', 'active', 'past_due']),
  ]);

  const subBySlot = new Map((subs ?? []).map((s) => [s.slot_id, s]));
  const orderedSlots = [...(slots ?? [])].sort(
    (a, b) => (SLOT_ORDER[a.slot_type] ?? 3) - (SLOT_ORDER[b.slot_type] ?? 3) || a.position - b.position,
  );
  const openSlots = orderedSlots
    .filter((s) => !subBySlot.has(s.id))
    .map((s) => ({ id: s.id, label: `${s.slot_type} #${s.position}` }));

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <Link
          href="/admin/ad-regions"
          className="text-muted hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Ad regions
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{region.name}</h1>
          <Badge tone="outline">Tier {TIER_LABEL[region.tier] ?? region.tier}</Badge>
          {!region.is_active && <Badge tone="muted">Inactive</Badge>}
          <Link
            href={`/advertise/${region.slug}`}
            className="text-primary text-sm hover:underline"
          >
            Public sales page →
          </Link>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Region settings</h2>
        <AdRegionForm
          region={{
            id: region.id,
            marketId: region.market_id,
            name: region.name,
            slug: region.slug,
            tier: region.tier,
            exclusiveMinCents: region.exclusive_price_min,
            exclusiveMaxCents: region.exclusive_price_max,
            isActive: region.is_active,
            sortOrder: region.sort_order,
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Crown className="text-primary h-5 w-5" /> Slot occupancy
        </h2>
        <div className="rounded-card border-border bg-surface shadow-card overflow-hidden border">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-muted text-left text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2.5 font-medium">Slot</th>
                <th className="px-4 py-2.5 font-medium">Holder</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">$/mo</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {orderedSlots.map((slot) => {
                const sub = subBySlot.get(slot.id);
                const shop = sub?.dispensary as { name: string; slug: string } | null | undefined;
                return (
                  <tr key={slot.id} className="bg-surface">
                    <td className="px-4 py-2.5 capitalize">
                      {slot.slot_type} #{slot.position}
                    </td>
                    <td className="px-4 py-2.5">
                      {shop ? (
                        <Link href={`/dispensary/${shop.slug}`} className="text-primary hover:underline">
                          {shop.name}
                        </Link>
                      ) : (
                        <span className="text-muted">Open</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {sub ? (
                        <Badge tone={sub.status === 'active' ? 'primary' : 'muted'}>{sub.status}</Badge>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2.5">{sub ? formatPrice(sub.price_paid) : '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      {sub && (
                        <span className="inline-flex items-center gap-2">
                          {sub.status === 'pending' && (
                            <form action={activateAdSubscription.bind(null, sub.id)}>
                              <button className="text-primary text-xs font-medium hover:underline">
                                Activate
                              </button>
                            </form>
                          )}
                          <DeleteButton
                            action={cancelAdSubscription.bind(null, sub.id)}
                            label="Cancel"
                            confirmText="Cancel this placement? The slot re-opens for sale immediately. If billing was already set up, remember to stop the invoice."
                          />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="card p-5">
          <h3 className="mb-2 text-sm font-semibold">
            Manual placement (negotiated exclusive / comp)
          </h3>
          <CompSlotForm slots={openSlots} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Zones ({zones?.length ?? 0})</h2>
        <div className="flex flex-wrap gap-2">
          {(zones ?? []).map((z) => (
            <span
              key={z.id}
              className="border-border bg-surface inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm"
            >
              {z.name}
              <DeleteButton
                action={deleteAdZone.bind(null, z.id, region.id)}
                label="×"
                confirmText={`Remove the ${z.name} zone? Searches there will fall back to the nearest remaining zone.`}
              />
            </span>
          ))}
        </div>
        <AdZoneForm regionId={region.id} />
      </section>

      <section className="max-w-2xl space-y-3">
        <h2 className="text-lg font-semibold">Region boundary</h2>
        <p className="text-muted text-sm">
          The current boundary is the generated convex hull of this region&apos;s zones. Paste
          hand-drawn GeoJSON (freeway-aligned per the territory plan) to replace it — validated
          server-side with ST_IsValid.
        </p>
        <AdBoundaryForm kind="region" targetId={region.id} label={region.name} />
      </section>
    </div>
  );
}
