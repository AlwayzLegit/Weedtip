'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

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

/** Plan request → active for a 30-day period; Growth includes the POS register. */
export async function activatePlanRequest(dispensaryId: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from('dispensary_subscriptions')
    .select('status, plan:plans(slug)')
    .eq('dispensary_id', dispensaryId)
    .maybeSingle();
  if (sub?.status !== 'pending') return;

  await supabase
    .from('dispensary_subscriptions')
    .update({
      status: 'active',
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('dispensary_id', dispensaryId);

  if ((sub.plan as { slug: string } | null)?.slug === 'growth') {
    await supabase.rpc('grant_pos_addon', { p_dispensary_id: dispensaryId, p_enabled: true });
  }
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
    .select('id, notes, type, dispensary_id, is_active')
    .eq('id', placementId)
    .maybeSingle();
  if (!placement || placement.is_active) return;

  const days = Number(/(\d+)\s*day/.exec(placement.notes ?? '')?.[1] ?? '30') || 30;
  const start = new Date();
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  await supabase
    .from('placements')
    .update({ is_active: true, starts_at: start.toISOString(), ends_at: end.toISOString() })
    .eq('id', placementId);
  if (placement.type === 'featured' && placement.dispensary_id) {
    await supabase.rpc('sync_featured_flags', { p_dispensary_id: placement.dispensary_id });
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
