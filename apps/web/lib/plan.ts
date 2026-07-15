import 'server-only';
import { cache } from 'react';
import { getAuth } from './auth';
import { getOwnerContext } from './owner';
import { createClient } from './supabase/server';

/**
 * Plan gating for owner-facing marketing features (deals, in-store promos,
 * follower updates). A dispensary is "paid" when it has an active subscription
 * on a plan that costs money (currently Growth, $99/mo). Free listings see these
 * features but must upgrade to use them — enforced in the UI (an upgrade wall)
 * AND in each server action here, so the gate can't be bypassed.
 */

/** Does this dispensary have an active paid (Growth) subscription? */
export async function dispensaryIsPaid(dispensaryId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('dispensary_subscriptions')
    .select('status, plan:plans(price_cents)')
    .eq('dispensary_id', dispensaryId)
    .maybeSingle();
  if (!data || data.status !== 'active') return false;
  const plan = data.plan as { price_cents: number } | null;
  return !!plan && plan.price_cents > 0;
}

export type OwnerPlan = { isPaid: boolean; planName: string; dispensaryId: string | null };

/**
 * The current owner's plan, for gating dashboard UI. Admins are treated as paid
 * so they can manage any shop. Memoized per request.
 */
export const getOwnerPlan = cache(async (): Promise<OwnerPlan> => {
  const ctx = await getOwnerContext();
  if (ctx.role === 'admin') {
    return { isPaid: true, planName: 'Admin', dispensaryId: ctx.dispensary?.id ?? null };
  }
  const isPaid = ctx.dispensary ? await dispensaryIsPaid(ctx.dispensary.id) : false;
  return { isPaid, planName: isPaid ? 'Growth' : 'Free', dispensaryId: ctx.dispensary?.id ?? null };
});

/**
 * Server-action gate for publishing marketing content. Paid dispensaries pass;
 * admins always pass (they manage any shop). Keeps UI + action decisions aligned.
 */
export async function canPublishMarketing(dispensaryId: string): Promise<boolean> {
  const { profile } = await getAuth();
  if (profile?.role === 'admin') return true;
  return dispensaryIsPaid(dispensaryId);
}

/** The plan a gated marketing feature upgrades to. */
export const GATED_PLAN_NAME = 'Growth';

/** Shared copy for the upgrade prompt on gated marketing actions. */
export const MARKETING_UPGRADE_MESSAGE =
  'This is a Growth feature. Upgrade to Growth to publish deals, promos, and follower updates.';
