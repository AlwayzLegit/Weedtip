'use server';

import { revalidatePath } from 'next/cache';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export type PosLine = { product_id: string; quantity: number };

/** Ring up an in-store POS sale (owner). Prices server-side; zero commission. */
export async function ringSale(
  items: PosLine[],
  paymentMethod: string,
): Promise<{ ok: boolean; orderId?: string; error?: string }> {
  if (!items || items.length === 0) return { ok: false, error: 'The ticket is empty.' };

  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_pos_order', {
    p_dispensary_id: dispensary.id,
    p_items: items,
    p_payment_method: paymentMethod,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard/register');
  revalidatePath('/dashboard/orders');
  revalidatePath('/dashboard/analytics');
  return { ok: true, orderId: data as string };
}
