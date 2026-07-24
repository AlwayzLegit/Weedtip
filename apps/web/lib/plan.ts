import 'server-only';
import { cache } from 'react';
import { getAuth } from './auth';
import { getOwnerContext } from './owner';
import { createClient } from './supabase/server';

/**
 * Plan tiers — deliberately just two:
 *
 *   free — claim/verify, name + logo + phone + hours, one cover, manual products
 *   paid — Weedtip Pro ($39/mo): EVERYTHING else — online orders, website,
 *          Google sync, complete profile, CSV/POS import, deals, promos, updates,
 *          analytics, taxes, team, and featured placement in your region.
 *
 * Features still declare a MINIMUM tier (rather than a boolean) so the ladder can
 * grow again later without rewriting every gate; today every paid feature sits at
 * `paid`. The effective tier is resolved in the DB by dispensary_tier(), which
 * takes the best of the active subscription and the `grandfathered` floor. Legacy
 * subscriptions on the old Basic/Growth plans still resolve to `paid` (any DB rank
 * >= 1 collapses here), so nobody loses access. Gates are enforced in the UI AND
 * in each server action, so they can't be bypassed.
 */
export type PlanTier = 'free' | 'paid';

export const TIER_RANK: Record<PlanTier, number> = { free: 0, paid: 1 };

export const TIER_LABEL: Record<PlanTier, string> = {
  free: 'Free',
  paid: 'Weedtip Pro',
};

/** The paid plan's marketed name. */
export const PAID_PLAN_NAME = 'Weedtip Pro';

/** The paid plan's price, in whole dollars — single source for UI copy. */
export const PAID_PLAN_PRICE = 39;

/**
 * Collapse a DB tier rank to a plan tier. The DB still stores the historical
 * 0/1/2 ranks (free/basic/growth); anything at or above 1 is now simply `paid`.
 */
export function tierFromRank(rank: number): PlanTier {
  return rank >= 1 ? 'paid' : 'free';
}

/** Does `tier` meet or exceed `required`? */
export function tierAtLeast(tier: PlanTier, required: PlanTier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[required];
}

/** The dispensary's effective tier (active subscription ∨ grandfathered floor). */
export async function getDispensaryTier(dispensaryId: string): Promise<PlanTier> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('dispensary_tier', { p_dispensary_id: dispensaryId });
  if (error || typeof data !== 'number') return 'free';
  return tierFromRank(data);
}

/** Back-compat: "paid" means anything above the free tier. */
export async function dispensaryIsPaid(dispensaryId: string): Promise<boolean> {
  return (await getDispensaryTier(dispensaryId)) !== 'free';
}

export type OwnerPlan = {
  tier: PlanTier;
  isPaid: boolean;
  planName: string;
  dispensaryId: string | null;
};

/**
 * The current owner's plan tier, for gating dashboard UI. Admins are treated as
 * paid so they can manage any shop. Memoized per request.
 */
export const getOwnerPlan = cache(async (): Promise<OwnerPlan> => {
  const ctx = await getOwnerContext();
  if (ctx.role === 'admin') {
    return {
      tier: 'paid',
      isPaid: true,
      planName: 'Admin',
      dispensaryId: ctx.dispensary?.id ?? null,
    };
  }
  const tier = ctx.dispensary ? await getDispensaryTier(ctx.dispensary.id) : 'free';
  return {
    tier,
    isPaid: tier !== 'free',
    planName: TIER_LABEL[tier],
    dispensaryId: ctx.dispensary?.id ?? null,
  };
});

/**
 * Server-action gate for publishing marketing content (deals/promos/updates) —
 * these live in Weedtip Pro. Admins always pass.
 */
export async function canPublishMarketing(dispensaryId: string): Promise<boolean> {
  const { profile } = await getAuth();
  if (profile?.role === 'admin') return true;
  return tierAtLeast(await getDispensaryTier(dispensaryId), 'paid');
}

/** The plan a gated feature upgrades to. */
export const GATED_PLAN_NAME = PAID_PLAN_NAME;

/** Shared copy for the upgrade prompt on gated marketing actions. */
export const MARKETING_UPGRADE_MESSAGE = `Publishing deals, promos, and follower updates is part of ${PAID_PLAN_NAME}. Upgrade for $${PAID_PLAN_PRICE}/mo to unlock it.`;

/** Shared copy for the upgrade prompt on gated essentials (orders, sync, import). */
export const BASIC_UPGRADE_MESSAGE = `This is a ${PAID_PLAN_NAME} feature. Upgrade for $${PAID_PLAN_PRICE}/mo to take online orders, show your website, sync Google, complete your profile, and bulk-import your menu.`;
