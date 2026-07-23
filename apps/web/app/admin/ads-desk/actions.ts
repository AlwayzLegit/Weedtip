'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { notifyUser } from '@/lib/notify';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

const HOUSE_TERM_DAYS = 30;
const RENEWAL_TERM_DAYS = 30;

function revalidateDesk() {
  revalidatePath('/admin/ads-desk');
}

/** Offer the incumbent first right of renewal at TODAY's step price. */
export async function offerRenewal(subscriptionId: string): Promise<void> {
  await requireAdmin();
  const service = createServiceClient();
  const { data: sub } = await service
    .from('ad_subscriptions')
    .select(
      'id, dispensary:dispensaries(name, owner_id), slot:ad_slots(slot_type, region_id, region:ad_regions(name))',
    )
    .eq('id', subscriptionId)
    .maybeSingle();
  const slot = sub?.slot as {
    slot_type: 'featured' | 'premium' | 'exclusive';
    region_id: string;
    region: { name: string } | null;
  } | null;
  const disp = sub?.dispensary as { name: string; owner_id: string | null } | null;
  if (!sub || !slot) return;

  const { data: price } = await service.rpc('slot_price_cents', {
    p_region_id: slot.region_id,
    p_slot_type: slot.slot_type,
  });
  if (typeof price !== 'number' || price <= 0) return;

  await service
    .from('ad_subscriptions')
    .update({ renewal_price_cents: price, renewal_offered_at: new Date().toISOString() })
    .eq('id', subscriptionId);

  if (disp?.owner_id) {
    await notifyUser(disp.owner_id, {
      type: 'ad_renewal_offer',
      title: `Renew your ${slot.slot_type} spot in ${slot.region?.name ?? 'your region'}`,
      body: `Your placement term is ending. As the current holder you get first right at the going rate — $${(price / 100).toFixed(2)}/mo. Accept from your Promote page.`,
      href: '/dashboard/promote',
    });
  }
  revalidateDesk();
}

/** Extend an accepted renewal: new term at the offered price. */
export async function extendRenewal(subscriptionId: string): Promise<void> {
  await requireAdmin();
  const service = createServiceClient();
  const { data: sub } = await service
    .from('ad_subscriptions')
    .select('id, ends_at, renewal_price_cents, dispensary_id, slot:ad_slots(slot_type, region_id)')
    .eq('id', subscriptionId)
    .maybeSingle();
  if (!sub?.renewal_price_cents) return;

  const base =
    sub.ends_at && new Date(sub.ends_at).getTime() > Date.now()
      ? new Date(sub.ends_at)
      : new Date();
  const { error: extendErr } = await service
    .from('ad_subscriptions')
    .update({
      status: 'active',
      price_paid: sub.renewal_price_cents,
      ends_at: new Date(base.getTime() + RENEWAL_TERM_DAYS * 86_400_000).toISOString(),
      renewal_price_cents: null,
      renewal_offered_at: null,
    })
    .eq('id', subscriptionId);
  // If the extension failed (e.g. the slot was resold after a cancellation),
  // leave the renewal_accept request OPEN so the accepted renewal is not
  // silently dropped from the queue.
  if (extendErr) return;

  // Close the matching renewal-accept request, if one exists.
  const slot = sub.slot as {
    slot_type: 'exclusive' | 'featured' | 'premium';
    region_id: string;
  } | null;
  if (slot && sub.dispensary_id) {
    await service
      .from('ad_requests')
      .update({ status: 'resolved' })
      .eq('dispensary_id', sub.dispensary_id)
      .eq('region_id', slot.region_id)
      .eq('slot_type', slot.slot_type)
      .eq('kind', 'renewal_accept')
      .eq('status', 'open');
  }
  revalidateDesk();
}

export async function setAdRequestStatus(
  requestId: string,
  status: 'resolved' | 'dismissed',
): Promise<void> {
  await requireAdmin();
  const supabase = await createClient(); // admin RLS update policy
  await supabase.from('ad_requests').update({ status }).eq('id', requestId);
  revalidateDesk();
}

/**
 * Cold-start fill: comp the region's best-presenting unclaimed-slot shops into
 * its open featured/premium slots as HOUSE placements — $0, time-boxed to
 * HOUSE_TERM_DAYS, labeled "Featured" on the site (not "Sponsored"), and
 * automatically preempted the moment a real buyer claims the slot.
 */
export async function houseFillRegion(regionId: string): Promise<void> {
  await requireAdmin();
  const service = createServiceClient();

  const [{ data: slots }, { data: candidates }] = await Promise.all([
    service
      .from('ad_slots')
      .select('id, slot_type, position')
      .eq('region_id', regionId)
      .in('slot_type', ['featured', 'premium'])
      .order('position'),
    service.rpc('region_house_candidates', { p_region_id: regionId, p_limit: 13 }),
  ]);
  if (!slots?.length || !candidates?.length) return;

  // Which slots are open?
  const { data: liveSubs } = await service
    .from('ad_subscriptions')
    .select('slot_id')
    .in(
      'slot_id',
      slots.map((s) => s.id),
    )
    .in('status', ['pending', 'active', 'past_due']);
  const taken = new Set((liveSubs ?? []).map((s) => s.slot_id));
  const open = slots.filter((s) => !taken.has(s.id));

  const ends = new Date(Date.now() + HOUSE_TERM_DAYS * 86_400_000).toISOString();
  let i = 0;
  for (const slot of open) {
    const candidate = candidates[i];
    if (!candidate) break;
    i += 1;
    await service.from('ad_subscriptions').insert({
      slot_id: slot.id,
      dispensary_id: candidate.dispensary_id,
      price_paid: 0,
      status: 'active',
      is_house: true,
      starts_at: new Date().toISOString(),
      ends_at: ends,
    });
  }
  revalidateDesk();
}
