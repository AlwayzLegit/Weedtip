'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Brand-side featured bidding. Placing a bid is SALES-LED — see
 * requestBrandBid in app/actions/billing.ts, which creates a PENDING bid the
 * admin activates after invoicing. The old placeBrandBid forwarder to
 * place_brand_bid was removed: that RPC inserted an immediately-ACTIVE bid
 * (column default) with no payment, so a brand owner could self-grant a free
 * featured slot. place_brand_bid is now revoked from authenticated too.
 */
export async function cancelBrandBid(bidId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_brand_bid', { p_bid_id: bidId });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/studio/bids');
  return { ok: true };
}
