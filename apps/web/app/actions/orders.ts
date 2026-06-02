'use server';

import { revalidatePath } from 'next/cache';
import { getAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * Buyer-initiated order cancellation. Only the buyer can cancel, and only while
 * the order is still pending or confirmed (not once it's ready/completed). RLS
 * (orders_update_party) also enforces buyer ownership.
 */
export async function cancelOrder(orderId: string): Promise<void> {
  const { user } = await getAuth();
  if (!user) return;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from('orders')
    .select('status,user_id')
    .eq('id', orderId)
    .maybeSingle();
  if (!order || order.user_id !== user.id) return;
  if (order.status !== 'pending' && order.status !== 'confirmed') return;

  await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId)
    .eq('user_id', user.id);

  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/orders');
}
