import 'server-only';
import { notifyUser } from './notify';
import { createServiceClient } from './supabase/service';

/**
 * Weedtip Pro bundles a Featured placement in the shop's own region. These
 * helpers grant it the moment the plan goes active and release it when the plan
 * ends — so the promise the plan card makes is kept without an admin hand-off.
 *
 * Economics (see the migration for the full note): plan-included claims carry
 * `is_house = true` so they never inflate a-la-carte step pricing and remain
 * preemptable by a real paying buyer, plus `plan_included = true` so the ad desk
 * can tell "bundled with Pro" apart from a hand-comped cold-start fill.
 */

export type PlanPlacementResult =
  | { status: 'granted'; regionName: string }
  | { status: 'waitlisted'; regionName: string }
  | { status: 'already_held'; regionName: string }
  | { status: 'no_region' };

/**
 * Give a shop its plan-included Featured slot in its own region. Idempotent:
 * a shop that already holds (or has requested) Featured there keeps what it has.
 * When the region's three Featured slots are all taken by PAID buyers, the shop
 * is waitlisted instead — the honest outcome the plan copy promises.
 */
export async function grantPlanFeaturedSlot(dispensaryId: string): Promise<PlanPlacementResult> {
  const service = createServiceClient();

  const { data: shop } = await service
    .from('dispensaries')
    .select('id, owner_id, latitude, longitude')
    .eq('id', dispensaryId)
    .maybeSingle();
  if (!shop || typeof shop.latitude !== 'number' || typeof shop.longitude !== 'number') {
    return { status: 'no_region' };
  }

  const { data: geoRows } = await service.rpc('resolve_geo', {
    lng: shop.longitude,
    lat: shop.latitude,
  });
  const geo = geoRows?.[0];
  if (!geo?.region_id) return { status: 'no_region' };
  const regionName: string = geo.region_name ?? 'your region';

  // Already holding or awaiting Featured here — nothing to do (re-activations
  // and repeat runs must not double-claim).
  const { data: existing } = await service
    .from('ad_subscriptions')
    .select('id, slot:ad_slots!inner(region_id, slot_type)')
    .eq('dispensary_id', dispensaryId)
    .in('status', ['pending', 'active', 'past_due'])
    .eq('slot.region_id', geo.region_id)
    .eq('slot.slot_type', 'featured')
    .limit(1);
  if (existing && existing.length > 0) return { status: 'already_held', regionName };

  // Free abandoned holds first, then take the lowest open Featured position.
  await service.rpc('release_stale_ad_claims');
  const { data: slots } = await service
    .from('ad_slots')
    .select('id, position')
    .eq('region_id', geo.region_id)
    .eq('slot_type', 'featured')
    .order('position');

  for (const slot of slots ?? []) {
    const { data, error } = await service.rpc('claim_plan_slot', {
      p_slot_id: slot.id,
      p_dispensary_id: dispensaryId,
    });
    if (!error && data) {
      // Featured flags drive the public "Featured" treatment on listings.
      await service.rpc('sync_featured_flags', { p_dispensary_id: dispensaryId });
      if (shop.owner_id) {
        await notifyUser(shop.owner_id, {
          type: 'billing_update',
          title: 'Your Featured placement is live',
          body: `Weedtip Pro includes a Featured spot — yours is now running in ${regionName}.`,
          href: '/dashboard/promote',
        });
      }
      return { status: 'granted', regionName };
    }
    if (error && !error.message.includes('SLOT_TAKEN')) break;
  }

  // Region is full of paid holders — waitlist rather than silently drop the
  // benefit. Duplicate rows no-op on the unique key; a resolved row re-opens.
  await service.from('ad_requests').upsert(
    {
      dispensary_id: dispensaryId,
      region_id: geo.region_id,
      slot_type: 'featured',
      kind: 'availability',
      status: 'open',
    },
    { onConflict: 'dispensary_id,region_id,slot_type,kind' },
  );
  if (shop.owner_id) {
    await notifyUser(shop.owner_id, {
      type: 'billing_update',
      title: 'You’re first in line for Featured',
      body: `Featured is full in ${regionName} right now. Your Weedtip Pro spot is reserved for the next opening.`,
      href: '/dashboard/promote',
    });
  }
  return { status: 'waitlisted', regionName };
}

/**
 * Release a shop's plan-included Featured slot (and clear its waitlist row) when
 * the plan ends. Only touches plan-included claims — a slot the shop actually
 * PAID for a-la-carte is theirs and must survive a plan change.
 */
export async function releasePlanFeaturedSlot(dispensaryId: string): Promise<void> {
  const service = createServiceClient();
  const { data: released } = await service
    .from('ad_subscriptions')
    .update({ status: 'canceled', ends_at: new Date().toISOString() })
    .eq('dispensary_id', dispensaryId)
    .eq('plan_included', true)
    .in('status', ['pending', 'active', 'past_due'])
    .select('id');

  await service
    .from('ad_requests')
    .update({ status: 'dismissed' })
    .eq('dispensary_id', dispensaryId)
    .eq('slot_type', 'featured')
    .eq('kind', 'availability')
    .eq('status', 'open');

  if (released?.length) {
    await service.rpc('sync_featured_flags', { p_dispensary_id: dispensaryId });
  }
}
