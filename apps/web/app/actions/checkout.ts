'use server';

import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import type Stripe from 'stripe';
import { z } from 'zod';
import { orderTypeSchema, type OrderItem } from '@weedtip/shared';
import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { isStripeConfigured, stripe } from '@/lib/stripe';

/**
 * Checkout entry point shared by web (and, via the same contract, mobile).
 *
 * Always creates a SERVER-AUTHORITATIVE order first (the `create_order` RPC derives
 * prices/totals from the DB). Then:
 *   • pay_now + Stripe configured → create a Stripe Checkout Session and return its
 *     URL for the client to redirect to. The webhook marks the order paid/confirmed.
 *   • otherwise → leave the order as a pay-at-dispensary order and return its id.
 */
export type StartCheckoutResult =
  | { ok: true; mode: 'redirect'; url: string }
  | { ok: true; mode: 'order'; orderId: string }
  | { ok: false; error: string };

const inputSchema = z.object({
  dispensary_id: z.string().uuid(),
  order_type: orderTypeSchema,
  notes: z.string().max(1000).optional(),
  promo_code: z.string().max(40).optional(),
  pay_now: z.boolean().optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().positive().max(99),
      }),
    )
    .min(1, 'Your cart is empty.'),
});

export type StartCheckoutInput = z.infer<typeof inputSchema>;

export type PromoPreview =
  | { ok: true; discountCents: number; title: string }
  | { ok: false; error: string };

/** Validates a promo code against the live deal and returns the discount it yields. */
export async function previewPromo(
  dispensaryId: string,
  code: string,
  subtotalCents: number,
): Promise<PromoPreview> {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, error: 'Enter a code.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc('compute_promo_discount', {
      p_dispensary_id: dispensaryId,
      p_code: trimmed,
      p_subtotal_cents: Math.max(0, Math.round(subtotalCents)),
    })
    .maybeSingle();

  if (error) return { ok: false, error: 'Could not check that code.' };
  if (!data || data.discount_cents <= 0) {
    return { ok: false, error: 'That code is not valid for this order.' };
  }
  return { ok: true, discountCents: data.discount_cents, title: data.title };
}

export type AutoDiscountPreview =
  | { ok: true; discountCents: number; title: string }
  | { ok: false };

/**
 * Best auto-applied order discount for the current cart — the larger of a
 * "spend & save" threshold (subtotal-based) and a BOGO offer (item-based),
 * mirroring create_order's precedence when no promo code is entered.
 */
export async function previewAutoDiscount(
  dispensaryId: string,
  subtotalCents: number,
  items: { product_id: string; quantity: number }[] = [],
): Promise<AutoDiscountPreview> {
  const supabase = await createClient();
  const [spend, bogo] = await Promise.all([
    supabase.rpc('compute_auto_order_discount', {
      p_dispensary_id: dispensaryId,
      p_subtotal_cents: Math.max(0, Math.round(subtotalCents)),
    }),
    items.length
      ? supabase.rpc('compute_bogo_discount', { p_dispensary_id: dispensaryId, p_items: items })
      : Promise.resolve({ data: null }),
  ]);
  const candidates = [spend.data?.[0], bogo.data?.[0]].filter(
    (r): r is { deal_id: string; discount_cents: number; title: string } =>
      !!r && r.discount_cents > 0,
  );
  if (candidates.length === 0) return { ok: false };
  const best = candidates.sort((a, b) => b.discount_cents - a.discount_cents)[0]!;
  return { ok: true, discountCents: best.discount_cents, title: best.title };
}

export type CheckoutRules = {
  state: string;
  taxRate: number;
  medicalOnly: boolean;
  canOrder: boolean;
  blockReason: string | null;
};

/**
 * The dispensary's market rules: per-state estimated tax rate, whether the
 * state is medical-only, and whether online ordering is allowed at all.
 * Mirrors the checks create_order enforces server-side.
 */
export async function getCheckoutRules(dispensaryId: string): Promise<CheckoutRules | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('checkout_rules', { p_dispensary_id: dispensaryId });
  const row = data?.[0];
  if (!row) return null;
  return {
    state: row.state,
    taxRate: Number(row.tax_rate),
    medicalOnly: row.medical_only,
    canOrder: row.can_order,
    blockReason: row.block_reason,
  };
}

export async function startCheckout(rawInput: StartCheckoutInput): Promise<StartCheckoutResult> {
  if (!(await rateLimit('checkout', { limit: 15, window: '60 s' })).success) {
    return { ok: false, error: 'Too many checkout attempts. Please wait a moment and try again.' };
  }

  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid order' };
  }
  const input = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in to place an order.' };

  const wantsOnline = !!input.pay_now && isStripeConfigured && stripe !== null;

  // Attribution: device from the user-agent, source from the wt_src cookie
  // (set by middleware when a shopper arrives via an embed link).
  const [hdrs, cookieStore] = await Promise.all([headers(), cookies()]);
  const ua = hdrs.get('user-agent') ?? '';
  const device = /tablet|ipad/i.test(ua)
    ? 'tablet'
    : /mobile|android|iphone/i.test(ua)
      ? 'mobile'
      : 'desktop';
  const source = cookieStore.get('wt_src')?.value === 'embed' ? 'embed' : 'web';

  // 1. Create the order (server-authoritative pricing). Always unpaid at creation.
  const { data: orderId, error: rpcError } = await supabase.rpc('create_order', {
    p_dispensary_id: input.dispensary_id,
    p_order_type: input.order_type,
    p_items: input.items,
    p_notes: input.notes ?? undefined,
    p_promo_code: input.promo_code?.trim() || undefined,
    p_source: source,
    p_device: device,
  });
  if (rpcError || !orderId) return { ok: false, error: rpcError?.message ?? 'Could not create order.' };

  revalidatePath('/orders');
  revalidatePath('/dashboard/orders');

  // 2a. Pay-at-dispensary (or Stripe not configured): record method, return order.
  if (!wantsOnline) {
    await supabase.from('orders').update({ payment_method: 'in_person' }).eq('id', orderId as string);
    return { ok: true, mode: 'order', orderId: orderId as string };
  }

  // 2b. Online prepay via Stripe Checkout.
  const { data: order } = await supabase
    .from('orders')
    .select('items, tax_cents, discount_cents')
    .eq('id', orderId as string)
    .single();

  if (!order) return { ok: true, mode: 'order', orderId: orderId as string };

  const items = (order.items as OrderItem[]) ?? [];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map(
    (it) => ({
      quantity: it.quantity,
      price_data: {
        currency: 'usd',
        unit_amount: it.unit_price_cents,
        product_data: { name: it.name },
      },
    }),
  );
  if (order.tax_cents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: order.tax_cents,
        product_data: { name: 'Estimated tax' },
      },
    });
  }

  // Apply any promo discount as a one-off Stripe coupon so the charge matches
  // the server-authoritative total.
  let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
  if (order.discount_cents > 0) {
    try {
      const coupon = await stripe!.coupons.create({
        amount_off: order.discount_cents,
        currency: 'usd',
        duration: 'once',
        name: 'Promo discount',
      });
      discounts = [{ coupon: coupon.id }];
    } catch {
      // If coupon creation fails, fall back to charging the undiscounted lines.
      discounts = undefined;
    }
  }

  try {
    const session = await stripe!.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      ...(discounts ? { discounts } : {}),
      client_reference_id: orderId as string,
      metadata: { order_id: orderId as string },
      success_url: `${siteUrl}/orders/${orderId}?paid=1`,
      cancel_url: `${siteUrl}/cart?canceled=1`,
      payment_intent_data: { metadata: { order_id: orderId as string } },
    });

    if (!session.url) return { ok: false, error: 'Could not start payment.' };

    await supabase
      .from('orders')
      .update({ payment_method: 'stripe', stripe_session_id: session.id })
      .eq('id', orderId as string);

    return { ok: true, mode: 'redirect', url: session.url };
  } catch (e) {
    // Payment couldn't start — the order still exists as pay-at-dispensary.
    await supabase.from('orders').update({ payment_method: 'in_person' }).eq('id', orderId as string);
    return {
      ok: false,
      error: e instanceof Error ? `Payment setup failed: ${e.message}` : 'Payment setup failed.',
    };
  }
}
