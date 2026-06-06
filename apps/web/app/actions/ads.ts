'use server';

import { revalidatePath } from 'next/cache';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export async function placeBid(
  regionId: string,
  bidCents: number,
): Promise<{ ok: boolean; error?: string }> {
  const { dispensary } = await requireOwnerDispensary();
  const supabase = await createClient();
  const { error } = await supabase.rpc('place_ad_bid', {
    p_region_id: regionId,
    p_dispensary_id: dispensary.id,
    p_bid_cents: Math.max(0, Math.round(bidCents)),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/ads');
  return { ok: true };
}

export async function cancelBid(bidId: string): Promise<{ ok: boolean; error?: string }> {
  await requireOwnerDispensary();
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_ad_bid', { p_bid_id: bidId });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/ads');
  return { ok: true };
}
