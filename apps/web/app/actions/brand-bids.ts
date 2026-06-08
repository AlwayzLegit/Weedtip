'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Brand-side featured bidding. The RPCs are SECURITY DEFINER and enforce brand
 * ownership (public.owns_brand), so these just forward the call.
 */
export async function placeBrandBid(
  brandId: string,
  regionId: string,
  bidCents: number,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('place_brand_bid', {
    p_region_id: regionId,
    p_brand_id: brandId,
    p_bid_cents: Math.max(0, Math.round(bidCents)),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/studio/bids');
  return { ok: true };
}

export async function cancelBrandBid(bidId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_brand_bid', { p_bid_id: bidId });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/studio/bids');
  return { ok: true };
}
