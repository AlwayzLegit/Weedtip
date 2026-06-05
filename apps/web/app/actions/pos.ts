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

/** Open a cash-drawer shift with a starting float. */
export async function openShift(
  openingFloatCents: number,
): Promise<{ ok: boolean; error?: string }> {
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  const { error } = await supabase.from('pos_shifts').insert({
    dispensary_id: dispensary.id,
    opened_by: user.id,
    opening_float_cents: Math.max(0, Math.round(openingFloatCents)),
  });
  if (error) {
    return {
      ok: false,
      error: error.code === '23505' ? 'A shift is already open.' : error.message,
    };
  }
  revalidatePath('/dashboard/register');
  return { ok: true };
}

/** Close the open shift; computes the Z-report (expected vs counted, by method). */
export async function closeShift(
  shiftId: string,
  countedCashCents: number,
): Promise<{ ok: boolean; error?: string }> {
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  const { data: shift } = await supabase
    .from('pos_shifts')
    .select('id,opened_at,opening_float_cents,closed_at')
    .eq('id', shiftId)
    .eq('dispensary_id', dispensary.id)
    .maybeSingle();
  if (!shift) return { ok: false, error: 'Shift not found.' };
  if (shift.closed_at) return { ok: false, error: 'This shift is already closed.' };

  const now = new Date().toISOString();
  const { data: sales } = await supabase
    .from('orders')
    .select('payment_method,total_cents')
    .eq('dispensary_id', dispensary.id)
    .eq('source', 'pos')
    .gte('created_at', shift.opened_at)
    .lte('created_at', now);

  let cash = 0;
  let card = 0;
  let debit = 0;
  let count = 0;
  for (const o of sales ?? []) {
    count += 1;
    if (o.payment_method === 'cash') cash += o.total_cents;
    else if (o.payment_method === 'card') card += o.total_cents;
    else if (o.payment_method === 'debit') debit += o.total_cents;
  }
  const counted = Math.max(0, Math.round(countedCashCents));
  const expected = shift.opening_float_cents + cash;

  const { error } = await supabase
    .from('pos_shifts')
    .update({
      closed_at: now,
      closed_by: user.id,
      closing_count_cents: counted,
      expected_cash_cents: expected,
      cash_sales_cents: cash,
      card_sales_cents: card,
      debit_sales_cents: debit,
      sales_count: count,
      over_short_cents: counted - expected,
    })
    .eq('id', shiftId)
    .eq('dispensary_id', dispensary.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard/register');
  return { ok: true };
}
