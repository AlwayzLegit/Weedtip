'use server';

import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { z } from 'zod';
import { deliveryAddressSchema, orderTypeSchema } from '@weedtip/shared';
import { newOrderForDispensaryEmail, orderConfirmationEmail, sendEmail } from '@/lib/email';
import { canUseFeature } from '@/lib/features';
import { rateLimit } from '@/lib/rate-limit';
import { getPlatformSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';

/**
 * Checkout entry point shared by web (and, via the same contract, mobile).
 *
 * Creates a SERVER-AUTHORITATIVE order (the `create_order` RPC derives
 * prices/totals from the DB). Weedtip never collects payment from shoppers:
 * pickup orders are paid at the store, delivery orders are paid to the
 * dispensary's delivery partner. The platform's revenue is B2B only.
 */
export type StartCheckoutResult =
  | { ok: true; mode: 'order'; orderId: string }
  | { ok: false; error: string };

const inputSchema = z
  .object({
    dispensary_id: z.string().uuid(),
    order_type: orderTypeSchema,
    notes: z.string().max(1000).optional(),
    promo_code: z.string().max(40).optional(),
    /**
     * How the shopper intends to pay THE DISPENSARY (Weedtip never processes
     * payment). Passed through to the store so they can prep the register /
     * tell the driver; actual acceptance is between shopper and store.
     */
    payment_method: z.enum(['cash', 'debit']).default('cash'),
    delivery_address: deliveryAddressSchema.optional(),
    /** Remember this address on the profile for next time. */
    save_address: z.boolean().optional(),
    items: z
      .array(
        z.object({
          product_id: z.string().uuid(),
          quantity: z.number().int().positive().max(99),
        }),
      )
      .min(1, 'Your cart is empty.'),
  })
  .refine((v) => v.order_type !== 'delivery' || !!v.delivery_address, {
    message: 'Enter a delivery address to place a delivery order.',
    path: ['delivery_address'],
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
  // Compliance kill-switch: online ordering can be disabled platform-wide. The
  // create_order RPC enforces this too (belt-and-suspenders for direct calls);
  // this is the friendly, earlier failure.
  if (!(await getPlatformSettings()).orderingEnabled) {
    return { ok: false, error: 'Online ordering is currently unavailable on Weedtip.' };
  }

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

  // A shop can pause incoming online orders without hiding its listing.
  const { data: acceptRow } = await supabase
    .from('dispensaries')
    .select('accepting_orders')
    .eq('id', input.dispensary_id)
    .maybeSingle();
  if (acceptRow && acceptRow.accepting_orders === false) {
    return { ok: false, error: 'This dispensary is not accepting online orders right now.' };
  }

  // Online ordering is a Basic-tier feature. create_order enforces this too (the
  // mobile app calls the RPC directly); this is the friendly, earlier failure.
  if (!(await canUseFeature(input.dispensary_id, 'orders'))) {
    return { ok: false, error: 'This dispensary is not set up to take online orders on Weedtip.' };
  }

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
    p_delivery_address:
      input.order_type === 'delivery' && input.delivery_address
        ? input.delivery_address
        : undefined,
  });
  if (rpcError || !orderId) return { ok: false, error: rpcError?.message ?? 'Could not create order.' };

  // Remember the address as the shopper's default for the next checkout.
  if (input.order_type === 'delivery' && input.delivery_address && input.save_address) {
    await supabase
      .from('profiles')
      .update({ delivery_address: input.delivery_address })
      .eq('id', user.id);
  }

  await supabase
    .from('orders')
    .update({ payment_method: input.payment_method })
    .eq('id', orderId as string);

  revalidatePath('/orders');
  revalidatePath('/dashboard/orders');

  // Notify both sides. Failures never block the order — email is best-effort.
  const [{ data: order }, { data: shop }] = await Promise.all([
    supabase
      .from('orders')
      .select('total_cents, items')
      .eq('id', orderId as string)
      .single(),
    supabase
      .from('dispensaries')
      .select('name, email')
      .eq('id', input.dispensary_id)
      .single(),
  ]);
  if (order && shop) {
    const emailInput = {
      orderId: orderId as string,
      dispensaryName: shop.name,
      orderType: input.order_type,
      paymentMethod: input.payment_method,
      totalCents: order.total_cents,
      itemCount: Array.isArray(order.items) ? order.items.length : input.items.length,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
    };
    if (user.email) {
      const m = orderConfirmationEmail(emailInput);
      await sendEmail({ to: user.email, subject: m.subject, html: m.html });
    }
    if (shop.email) {
      const m = newOrderForDispensaryEmail(emailInput);
      await sendEmail({ to: shop.email, subject: m.subject, html: m.html });
    }
  }

  return { ok: true, mode: 'order', orderId: orderId as string };
}
