'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { orderTypeSchema } from '@weedtip/shared';
import { createClient } from '@/lib/supabase/server';

/**
 * Create an order via the `create_order` Postgres RPC — the single, shared,
 * SERVER-AUTHORITATIVE order-creation contract used by both web and mobile.
 * The client sends only product ids + quantities; the database derives prices,
 * the line-item snapshot, and totals, so a tampered cart can't set its own prices.
 */
export type CreateOrderResult = { ok: true; orderId: string } | { ok: false; error: string };

const inputSchema = z.object({
  dispensary_id: z.string().uuid(),
  order_type: orderTypeSchema,
  notes: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().positive().max(99),
      }),
    )
    .min(1, 'Your cart is empty.'),
});

export type CreateOrderInput = z.infer<typeof inputSchema>;

export async function createOrder(rawInput: CreateOrderInput): Promise<CreateOrderResult> {
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

  const { data, error } = await supabase.rpc('create_order', {
    p_dispensary_id: input.dispensary_id,
    p_order_type: input.order_type,
    p_items: input.items,
    p_notes: input.notes ?? undefined,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/orders');
  revalidatePath('/dashboard/orders');
  return { ok: true, orderId: data as string };
}
