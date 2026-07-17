'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { notifyUser } from '@/lib/notify';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/** Notify a dispensary's owner about a billing decision. */
async function notifyDispensaryOwner(
  dispensaryId: string,
  title: string,
  body: string,
): Promise<void> {
  const supabase = await createClient();
  const { data: shop } = await supabase
    .from('dispensaries')
    .select('owner_id')
    .eq('id', dispensaryId)
    .maybeSingle();
  if (shop?.owner_id) {
    await notifyUser(shop.owner_id, { type: 'billing_update', title, body, href: '/dashboard/promote' });
  }
}

/**
 * Billing console actions: activate or reject the PENDING records the
 * sales-led request flows create (plans, placements, brand bids; ad-slot
 * requests use activateAdSubscription in ad-region-actions.ts). Activation
 * happens once the team has arranged invoicing — when the PaymentCloud
 * gateway lands, its webhook will drive these same transitions automatically.
 */

function refresh() {
  revalidatePath('/admin/billing');
  revalidatePath('/admin/promotions');
  revalidatePath('/admin');
}

/**
 * Plan request → active. Sales-led subscriptions are EVERGREEN
 * (current_period_end = null): the team invoices monthly and cancels on
 * non-payment via cancelPlan/reject — a hardcoded 30-day period would
 * silently strip perks from paying customers on day 31, since nothing
 * renews it until the PaymentCloud gateway manages real periods.
 */
export async function activatePlanRequest(dispensaryId: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from('dispensary_subscriptions')
    .select('status, plan:plans(price_cents)')
    .eq('dispensary_id', dispensaryId)
    .maybeSingle();
  if (sub?.status !== 'pending') return;

  const { data: updated, error } = await supabase
    .from('dispensary_subscriptions')
    .update({
      status: 'active',
      current_period_end: null,
      updated_at: new Date().toISOString(),
    })
    .eq('dispensary_id', dispensaryId)
    .eq('status', 'pending')
    .select('dispensary_id');
  if (error || !updated?.length) {
    throw new Error(error?.message ?? 'Request was already handled — refresh and re-check.');
  }

  // POS is bundled with the paid plan — gate on PRICE, not a plan slug, so this
  // works across the prod (`plus`) and post-reset (`growth`) price books.
  if (((sub.plan as { price_cents: number } | null)?.price_cents ?? 0) > 0) {
    // Service client: grant_pos_addon's EXECUTE is service_role-only (the
    // authenticated role gets permission-denied even for admins).
    const service = createServiceClient();
    const { error: posErr } = await service.rpc('grant_pos_addon', {
      p_dispensary_id: dispensaryId,
      p_enabled: true,
    });
    if (posErr) {
      throw new Error(`Plan activated but POS grant failed: ${posErr.message} — grant it manually.`);
    }
  }
  await notifyDispensaryOwner(
    dispensaryId,
    'Your Growth plan is active',
    'Your plan was activated — marketing tools, POS, and advanced analytics are unlocked.',
  );
  refresh();
}

/** Brand plan request → active (no POS — that's dispensary-only). */
export async function activateBrandPlanRequest(brandId: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from('brand_subscriptions')
    .update({ status: 'active', current_period_end: null, updated_at: new Date().toISOString() })
    .eq('brand_id', brandId)
    .eq('status', 'pending')
    .select('brand_id');
  if (error || !updated?.length) {
    throw new Error(error?.message ?? 'Request was already handled — refresh and re-check.');
  }
  const { data: brand } = await supabase
    .from('brands')
    .select('owner_id, name')
    .eq('id', brandId)
    .maybeSingle();
  if (brand?.owner_id) {
    await notifyUser(brand.owner_id, {
      type: 'billing_update',
      title: `Your ${brand.name} plan is active`,
      body: 'Your Brand Studio plan was activated — catalog, analytics, and updates are unlocked.',
      href: '/studio/promote',
    });
  }
  revalidatePath('/studio/promote');
  refresh();
}

export async function rejectBrandPlanRequest(brandId: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  await supabase
    .from('brand_subscriptions')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('brand_id', brandId)
    .eq('status', 'pending');
  refresh();
}

export async function rejectPlanRequest(dispensaryId: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  await supabase
    .from('dispensary_subscriptions')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('dispensary_id', dispensaryId)
    .eq('status', 'pending');
  // A pending request may have replaced a formerly-active Growth sub — make
  // sure no paid entitlement outlives the rejection.
  const service = createServiceClient();
  await service.rpc('grant_pos_addon', { p_dispensary_id: dispensaryId, p_enabled: false });
  refresh();
}

/**
 * Placement request → live for its requested duration (days are recorded in
 * the notes at request time; default 30 when absent).
 */
export async function activatePlacementRequest(placementId: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: placement } = await supabase
    .from('placements')
    .select('id, notes, type, dispensary_id, status')
    .eq('id', placementId)
    .maybeSingle();
  if (!placement || placement.status !== 'pending') return;

  // Days are server-authored into notes at request time ("… · N days", N
  // clamped 1–90 by the request schema), so the parse is trusted input.
  const days = Number(/(\d+)\s*day/.exec(placement.notes ?? '')?.[1] ?? '30') || 30;
  const start = new Date();
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  const { data: updated } = await supabase
    .from('placements')
    .update({
      status: 'active',
      is_active: true,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
    })
    .eq('id', placementId)
    .eq('status', 'pending')
    .select('id');
  if (!updated?.length) throw new Error('Request was already handled — refresh and re-check.');
  if (placement.type === 'featured' && placement.dispensary_id) {
    await supabase.rpc('sync_featured_flags', { p_dispensary_id: placement.dispensary_id });
  }
  if (placement.dispensary_id) {
    await notifyDispensaryOwner(
      placement.dispensary_id,
      'Your promotion is live',
      `Your ${placement.type} placement is now running.`,
    );
  }
  refresh();
}

/** Brand bid request → active for its 2-month term (SECURITY DEFINER RPC). */
export async function activateBrandBidRequest(bidId: string): Promise<void> {
  await requireAdmin();
  const service = createServiceClient();
  await service.rpc('activate_brand_bid', { p_bid_id: bidId });
  refresh();
}

export async function rejectBrandBidRequest(bidId: string): Promise<void> {
  await requireAdmin();
  const service = createServiceClient();
  await service.from('brand_ad_bids').delete().eq('id', bidId).eq('status', 'pending');
  refresh();
}
