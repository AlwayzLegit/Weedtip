'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireOwnerDispensary } from '@/lib/owner';
import {
  placementPriceCents,
  PLACEMENT_MAX_DAYS,
  PLACEMENT_MIN_DAYS,
  PLACEMENT_TYPE_LABEL,
  type PlacementType,
} from '@/lib/placement-pricing';
import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { isStripeConfigured, stripe } from '@/lib/stripe';

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

/** Start a recurring subscription to a plan via Stripe Checkout. */
export async function startSubscriptionCheckout(planId: string): Promise<CheckoutResult> {
  if (!(await rateLimit('billing', { limit: 15, window: '60 s' })).success) {
    return { ok: false, error: 'Too many attempts. Please wait a moment.' };
  }
  if (!isStripeConfigured || !stripe) {
    return { ok: false, error: 'Online billing is not enabled yet.' };
  }

  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from('plans')
    .select('id, name, price_cents, is_active')
    .eq('id', planId)
    .maybeSingle();
  if (!plan || !plan.is_active) return { ok: false, error: 'That plan is unavailable.' };
  if (plan.price_cents <= 0) return { ok: false, error: 'The Free plan does not require checkout.' };

  // Reuse an existing Stripe customer if this dispensary already has one.
  const { data: sub } = await supabase
    .from('dispensary_subscriptions')
    .select('stripe_customer_id')
    .eq('dispensary_id', dispensary.id)
    .maybeSingle();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ...(sub?.stripe_customer_id
        ? { customer: sub.stripe_customer_id }
        : { customer_email: user?.email ?? undefined }),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: plan.price_cents,
            recurring: { interval: 'month' },
            product_data: { name: `Weedtip ${plan.name} plan` },
          },
        },
      ],
      client_reference_id: dispensary.id,
      metadata: { dispensary_id: dispensary.id, plan_id: plan.id },
      subscription_data: { metadata: { dispensary_id: dispensary.id, plan_id: plan.id } },
      success_url: `${siteUrl()}/dashboard/promote?billing=subscribed`,
      cancel_url: `${siteUrl()}/dashboard/promote?billing=cancel`,
    });
    if (!session.url) return { ok: false, error: 'Could not start checkout.' };
    return { ok: true, url: session.url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Checkout failed.' };
  }
}

/** Monthly price of the POS register add-on, in cents. */
const POS_ADDON_PRICE_CENTS = 9900;

/** Subscribe to the POS register add-on. The webhook flips dispensaries.pos_addon. */
export async function startPosAddonCheckout(): Promise<CheckoutResult> {
  if (!(await rateLimit('billing', { limit: 15, window: '60 s' })).success) {
    return { ok: false, error: 'Too many attempts. Please wait a moment.' };
  }
  if (!isStripeConfigured || !stripe) {
    return { ok: false, error: 'Online billing is not enabled yet.' };
  }

  const { dispensary } = await requireOwnerDispensary();
  if (dispensary.pos_addon) {
    return { ok: false, error: 'The POS add-on is already active.' };
  }

  const supabase = await createClient();
  const { data: sub } = await supabase
    .from('dispensary_subscriptions')
    .select('stripe_customer_id')
    .eq('dispensary_id', dispensary.id)
    .maybeSingle();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const meta = { dispensary_id: dispensary.id, addon: 'pos' };
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ...(sub?.stripe_customer_id
        ? { customer: sub.stripe_customer_id }
        : { customer_email: user?.email ?? undefined }),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: POS_ADDON_PRICE_CENTS,
            recurring: { interval: 'month' },
            product_data: { name: 'Weedtip POS register add-on' },
          },
        },
      ],
      metadata: meta,
      subscription_data: { metadata: meta },
      success_url: `${siteUrl()}/dashboard/register?billing=pos`,
      cancel_url: `${siteUrl()}/dashboard/register?billing=cancel`,
    });
    if (!session.url) return { ok: false, error: 'Could not start checkout.' };
    return { ok: true, url: session.url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Checkout failed.' };
  }
}

/** Open the Stripe billing portal so the owner can manage/cancel their plan. */
export async function openBillingPortal(): Promise<CheckoutResult> {
  if (!isStripeConfigured || !stripe) {
    return { ok: false, error: 'Online billing is not enabled yet.' };
  }
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from('dispensary_subscriptions')
    .select('stripe_customer_id')
    .eq('dispensary_id', dispensary.id)
    .maybeSingle();
  if (!sub?.stripe_customer_id) {
    return { ok: false, error: 'No billing account yet — subscribe to a plan first.' };
  }
  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${siteUrl()}/dashboard/promote`,
    });
    return { ok: true, url: portal.url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not open billing portal.' };
  }
}

const placementSchema = z.object({
  type: z.enum(['featured', 'hero', 'promoted_deal', 'promoted_product']),
  scope: z.enum(['city', 'state', 'nationwide']),
  days: z.number().int().min(PLACEMENT_MIN_DAYS).max(PLACEMENT_MAX_DAYS),
  target_id: z.string().uuid().optional(),
});
export type StartPlacementInput = z.infer<typeof placementSchema>;

/**
 * Buy a one-time, time-boxed placement. Creates a PENDING placement (is_active
 * = false) scoped to this dispensary, then a Stripe Checkout session. The webhook
 * activates it on payment. Price is recomputed here from the rate card.
 */
export async function startPlacementCheckout(raw: StartPlacementInput): Promise<CheckoutResult> {
  if (!(await rateLimit('billing', { limit: 15, window: '60 s' })).success) {
    return { ok: false, error: 'Too many attempts. Please wait a moment.' };
  }
  if (!isStripeConfigured || !stripe) {
    return { ok: false, error: 'Online billing is not enabled yet.' };
  }

  const parsed = placementSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid request.' };
  const input = parsed.data;

  if ((input.type === 'promoted_deal' || input.type === 'promoted_product') && !input.target_id) {
    return { ok: false, error: 'Select which item to promote.' };
  }

  const { dispensary } = await requireOwnerDispensary();

  // Translate scope tier into the geo-targeting columns from the dispensary.
  const scope_state = input.scope === 'nationwide' ? null : dispensary.state;
  const scope_city = input.scope === 'city' ? dispensary.city : null;
  const priceCents = placementPriceCents(input.type, input.scope, input.days);

  // Insert the pending placement with the service client (RLS restricts writes to
  // admins; we've already authorized the owner against their own dispensary).
  const service = createServiceClient();
  const { data: placement, error: insErr } = await service
    .from('placements')
    .insert({
      dispensary_id: dispensary.id,
      type: input.type,
      target_id: input.target_id ?? null,
      scope_state,
      scope_city,
      is_active: false,
      price_cents: priceCents,
      notes: `Self-serve · ${input.days} day${input.days === 1 ? '' : 's'}`,
    })
    .select('id')
    .single();
  if (insErr || !placement) return { ok: false, error: 'Could not create the placement.' };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: priceCents,
            product_data: {
              name: `${PLACEMENT_TYPE_LABEL[input.type]} — ${input.days} days`,
            },
          },
        },
      ],
      client_reference_id: placement.id,
      metadata: { placement_id: placement.id, days: String(input.days) },
      payment_intent_data: { metadata: { placement_id: placement.id } },
      success_url: `${siteUrl()}/dashboard/promote?billing=placement`,
      cancel_url: `${siteUrl()}/dashboard/promote?billing=cancel`,
    });
    if (!session.url) {
      await service.from('placements').delete().eq('id', placement.id);
      return { ok: false, error: 'Could not start checkout.' };
    }
    await service
      .from('placements')
      .update({ stripe_session_id: session.id })
      .eq('id', placement.id);
    revalidatePath('/dashboard/promote');
    return { ok: true, url: session.url };
  } catch (e) {
    await service.from('placements').delete().eq('id', placement.id);
    return { ok: false, error: e instanceof Error ? e.message : 'Checkout failed.' };
  }
}

const brandPlacementSchema = z.object({
  brand_id: z.string().uuid(),
  days: z.number().int().min(PLACEMENT_MIN_DAYS).max(PLACEMENT_MAX_DAYS),
  state: z
    .string()
    .trim()
    .length(2)
    .transform((s) => s.toUpperCase())
    .optional(),
});
export type StartBrandPlacementInput = z.infer<typeof brandPlacementSchema>;

/**
 * Buy a one-time, nationwide brand promotion. Verifies the caller owns the brand,
 * creates a PENDING `promoted_brand` placement, then a Stripe Checkout session;
 * the shared webhook activates it on payment.
 */
export async function startBrandPlacementCheckout(
  raw: StartBrandPlacementInput,
): Promise<CheckoutResult> {
  if (!(await rateLimit('billing', { limit: 15, window: '60 s' })).success) {
    return { ok: false, error: 'Too many attempts. Please wait a moment.' };
  }
  if (!isStripeConfigured || !stripe) {
    return { ok: false, error: 'Online billing is not enabled yet.' };
  }

  const parsed = brandPlacementSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid request.' };
  }
  const input = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, owner_id')
    .eq('id', input.brand_id)
    .maybeSingle();
  if (!brand || brand.owner_id !== user.id) {
    return { ok: false, error: 'You do not own this brand.' };
  }

  // Nationwide, or targeted to a single state's Brands page (costs more for reach).
  const scope = input.state ? 'state' : 'nationwide';
  const priceCents = placementPriceCents('promoted_brand', scope, input.days);
  const where = input.state ? input.state : 'Nationwide';

  const service = createServiceClient();
  const { data: placement, error: insErr } = await service
    .from('placements')
    .insert({
      brand_id: brand.id,
      type: 'promoted_brand',
      scope_state: input.state ?? null,
      is_active: false,
      price_cents: priceCents,
      notes: `Self-serve brand promo · ${where} · ${input.days} day${input.days === 1 ? '' : 's'}`,
    })
    .select('id')
    .single();
  if (insErr || !placement) return { ok: false, error: 'Could not create the placement.' };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: priceCents,
            product_data: { name: `Promoted brand: ${brand.name} — ${input.days} days` },
          },
        },
      ],
      client_reference_id: placement.id,
      metadata: { placement_id: placement.id, days: String(input.days) },
      payment_intent_data: { metadata: { placement_id: placement.id } },
      success_url: `${siteUrl()}/studio/promote?billing=placement`,
      cancel_url: `${siteUrl()}/studio/promote?billing=cancel`,
    });
    if (!session.url) {
      await service.from('placements').delete().eq('id', placement.id);
      return { ok: false, error: 'Could not start checkout.' };
    }
    await service.from('placements').update({ stripe_session_id: session.id }).eq('id', placement.id);
    revalidatePath('/studio/promote');
    return { ok: true, url: session.url };
  } catch (e) {
    await service.from('placements').delete().eq('id', placement.id);
    return { ok: false, error: e instanceof Error ? e.message : 'Checkout failed.' };
  }
}

const brandBidSchema = z.object({
  brand_id: z.string().uuid(),
  region_id: z.string().uuid(),
  bid_cents: z.number().int().min(50).max(100_000_00),
});
export type StartBrandBidInput = z.infer<typeof brandBidSchema>;

/**
 * Pay for a brand featured-auction bid. Verifies brand ownership + the market
 * floor, creates a PENDING bid, then a Stripe Checkout session for the bid amount
 * (the 2-month term). The webhook flips it to 'active' on payment.
 */
export async function startBrandBidCheckout(raw: StartBrandBidInput): Promise<CheckoutResult> {
  if (!(await rateLimit('billing', { limit: 15, window: '60 s' })).success) {
    return { ok: false, error: 'Too many attempts. Please wait a moment.' };
  }
  if (!isStripeConfigured || !stripe) {
    return { ok: false, error: 'Online billing is not enabled yet.' };
  }

  const parsed = brandBidSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid request.' };
  }
  const input = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, owner_id')
    .eq('id', input.brand_id)
    .maybeSingle();
  if (!brand || brand.owner_id !== user.id) {
    return { ok: false, error: 'You do not own this brand.' };
  }

  const { data: region } = await supabase
    .from('brand_ad_regions')
    .select('id, name, featured_rate_cents, is_active')
    .eq('id', input.region_id)
    .maybeSingle();
  if (!region || !region.is_active) return { ok: false, error: 'That market is unavailable.' };
  if (input.bid_cents < region.featured_rate_cents) {
    return { ok: false, error: 'Bid is below the market floor.' };
  }

  // Service client: bid writes are admin-only under RLS, and we've authorized the
  // brand owner above. Clear any stale pending bid, then create a fresh one.
  const service = createServiceClient();
  await service
    .from('brand_ad_bids')
    .delete()
    .eq('brand_id', brand.id)
    .eq('region_id', region.id)
    .eq('status', 'pending');
  const placeholderEnd = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: bid, error: insErr } = await service
    .from('brand_ad_bids')
    .insert({
      region_id: region.id,
      brand_id: brand.id,
      bid_cents: input.bid_cents,
      status: 'pending',
      contract_end: placeholderEnd,
    })
    .select('id')
    .single();
  if (insErr || !bid) return { ok: false, error: 'Could not create the bid.' };

  try {
    const meta = { kind: 'brand_bid', bid_id: bid.id };
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: input.bid_cents,
            product_data: { name: `Featured bid: ${brand.name} — ${region.name} (2-month term)` },
          },
        },
      ],
      client_reference_id: bid.id,
      metadata: meta,
      payment_intent_data: { metadata: meta },
      success_url: `${siteUrl()}/studio/bids?billing=bid`,
      cancel_url: `${siteUrl()}/studio/bids?billing=cancel`,
    });
    if (!session.url) {
      await service.from('brand_ad_bids').delete().eq('id', bid.id);
      return { ok: false, error: 'Could not start checkout.' };
    }
    await service.from('brand_ad_bids').update({ stripe_session_id: session.id }).eq('id', bid.id);
    revalidatePath('/studio/bids');
    return { ok: true, url: session.url };
  } catch (e) {
    await service.from('brand_ad_bids').delete().eq('id', bid.id);
    return { ok: false, error: e instanceof Error ? e.message : 'Checkout failed.' };
  }
}

const adBidSchema = z.object({
  region_id: z.string().uuid(),
  bid_cents: z.number().int().min(50).max(100_000_00),
});
export type StartAdBidInput = z.infer<typeof adBidSchema>;

/**
 * Pay for a dispensary regional ad bid (mirrors startBrandBidCheckout). Verifies
 * the dispensary is in the region + meets the floor, creates a PENDING bid, then
 * a Stripe Checkout session for the bid amount (the 2-month term). The webhook
 * flips it to 'active' on payment.
 */
export async function startAdBidCheckout(raw: StartAdBidInput): Promise<CheckoutResult> {
  if (!(await rateLimit('billing', { limit: 15, window: '60 s' })).success) {
    return { ok: false, error: 'Too many attempts. Please wait a moment.' };
  }
  if (!isStripeConfigured || !stripe) {
    return { ok: false, error: 'Online billing is not enabled yet.' };
  }

  const parsed = adBidSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid request.' };
  }
  const input = parsed.data;

  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();

  const { data: region } = await supabase
    .from('ad_regions')
    .select('id, name, state, city, featured_rate_cents, is_active')
    .eq('id', input.region_id)
    .maybeSingle();
  if (!region || !region.is_active) return { ok: false, error: 'That region is unavailable.' };
  if (
    region.state !== dispensary.state ||
    (region.city && region.city.toLowerCase() !== (dispensary.city ?? '').toLowerCase())
  ) {
    return { ok: false, error: 'Your shop is not in this region.' };
  }
  if (input.bid_cents < region.featured_rate_cents) {
    return { ok: false, error: 'Bid is below the region floor.' };
  }

  const service = createServiceClient();
  await service
    .from('ad_bids')
    .delete()
    .eq('dispensary_id', dispensary.id)
    .eq('region_id', region.id)
    .eq('status', 'pending');
  const placeholderEnd = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: bid, error: insErr } = await service
    .from('ad_bids')
    .insert({
      region_id: region.id,
      dispensary_id: dispensary.id,
      bid_cents: input.bid_cents,
      status: 'pending',
      contract_end: placeholderEnd,
    })
    .select('id')
    .single();
  if (insErr || !bid) return { ok: false, error: 'Could not create the bid.' };

  try {
    const meta = { kind: 'ad_bid', bid_id: bid.id };
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: input.bid_cents,
            product_data: {
              name: `Featured bid: ${dispensary.name} — ${region.name} (2-month term)`,
            },
          },
        },
      ],
      client_reference_id: bid.id,
      metadata: meta,
      payment_intent_data: { metadata: meta },
      success_url: `${siteUrl()}/dashboard/ads?billing=bid`,
      cancel_url: `${siteUrl()}/dashboard/ads?billing=cancel`,
    });
    if (!session.url) {
      await service.from('ad_bids').delete().eq('id', bid.id);
      return { ok: false, error: 'Could not start checkout.' };
    }
    await service.from('ad_bids').update({ stripe_session_id: session.id }).eq('id', bid.id);
    revalidatePath('/dashboard/ads');
    return { ok: true, url: session.url };
  } catch (e) {
    await service.from('ad_bids').delete().eq('id', bid.id);
    return { ok: false, error: e instanceof Error ? e.message : 'Checkout failed.' };
  }
}

// Re-export the type for callers that map over placement types.
export type { PlacementType };
