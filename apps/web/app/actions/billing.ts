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

  // Brands aren't geo-scoped, so brand promotions are always nationwide.
  const priceCents = placementPriceCents('promoted_brand', 'nationwide', input.days);

  const service = createServiceClient();
  const { data: placement, error: insErr } = await service
    .from('placements')
    .insert({
      brand_id: brand.id,
      type: 'promoted_brand',
      is_active: false,
      price_cents: priceCents,
      notes: `Self-serve brand promo · ${input.days} day${input.days === 1 ? '' : 's'}`,
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
      success_url: `${siteUrl()}/dashboard/brands?billing=placement`,
      cancel_url: `${siteUrl()}/dashboard/brands?billing=cancel`,
    });
    if (!session.url) {
      await service.from('placements').delete().eq('id', placement.id);
      return { ok: false, error: 'Could not start checkout.' };
    }
    await service.from('placements').update({ stripe_session_id: session.id }).eq('id', placement.id);
    revalidatePath('/dashboard/brands');
    return { ok: true, url: session.url };
  } catch (e) {
    await service.from('placements').delete().eq('id', placement.id);
    return { ok: false, error: e instanceof Error ? e.message : 'Checkout failed.' };
  }
}

// Re-export the type for callers that map over placement types.
export type { PlacementType };
