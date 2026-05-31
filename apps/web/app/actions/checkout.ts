'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { orderTypeSchema, type OrderItem } from '@weedtip/shared';
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

export async function startCheckout(rawInput: StartCheckoutInput): Promise<StartCheckoutResult> {
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

  // 1. Create the order (server-authoritative pricing). Always unpaid at creation.
  const { data: orderId, error: rpcError } = await supabase.rpc('create_order', {
    p_dispensary_id: input.dispensary_id,
    p_order_type: input.order_type,
    p_items: input.items,
    p_notes: input.notes ?? undefined,
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
    .select('items, tax_cents')
    .eq('id', orderId as string)
    .single();

  if (!order) return { ok: true, mode: 'order', orderId: orderId as string };

  const items = (order.items as OrderItem[]) ?? [];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const lineItems: import('stripe').Stripe.Checkout.SessionCreateParams.LineItem[] = items.map(
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

  try {
    const session = await stripe!.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
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
