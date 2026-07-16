import 'server-only';
import { cache } from 'react';
import { getAuth } from './auth';
import { getOwnerContext } from './owner';
import { createClient } from './supabase/server';

/**
 * Plan tiers. Features declare a MINIMUM tier rather than a boolean "is paid",
 * so the ladder can grow without rewriting every gate:
 *
 *   free   — claim/verify, name + logo + phone + hours, one cover, manual products
 *   basic  — + online orders, website link, Google sync, complete profile,
 *              CSV import + store sync
 *   growth — + deals, promos, updates, analytics, taxes, team
 *
 * The effective tier is resolved in the DB by dispensary_tier(), which takes the
 * best of the active subscription and the `grandfathered` floor (listings claimed
 * before Basic existed keep tier-1 access for free). Gates are enforced in the UI
 * AND in each server action, so they can't be bypassed.
 */
export type PlanTier = 'free' | 'basic' | 'growth';

export const TIER_RANK: Record<PlanTier, number> = { free: 0, basic: 1, growth: 2 };

export const TIER_LABEL: Record<PlanTier, string> = {
  free: 'Free',
  basic: 'Basic',
  growth: 'Growth',
};

export function tierFromRank(rank: number): PlanTier {
  return rank >= 2 ? 'growth' : rank >= 1 ? 'basic' : 'free';
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
 * top-tier so they can manage any shop. Memoized per request.
 */
export const getOwnerPlan = cache(async (): Promise<OwnerPlan> => {
  const ctx = await getOwnerContext();
  if (ctx.role === 'admin') {
    return { tier: 'growth', isPaid: true, planName: 'Admin', dispensaryId: ctx.dispensary?.id ?? null };
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
 * these sit at the Growth tier. Admins always pass.
 */
export async function canPublishMarketing(dispensaryId: string): Promise<boolean> {
  const { profile } = await getAuth();
  if (profile?.role === 'admin') return true;
  return tierAtLeast(await getDispensaryTier(dispensaryId), 'growth');
}

/** The plan a gated marketing feature upgrades to. */
export const GATED_PLAN_NAME = 'Growth';

/** Shared copy for the upgrade prompt on gated marketing actions. */
export const MARKETING_UPGRADE_MESSAGE =
  'This is a Growth feature. Upgrade to Growth to publish deals, promos, and follower updates.';

/** Shared copy for the upgrade prompt on gated Basic-tier essentials. */
export const BASIC_UPGRADE_MESSAGE =
  'This is a Basic feature. Upgrade to Basic to take online orders, show your website, sync Google, complete your profile, and bulk-import your menu.';
