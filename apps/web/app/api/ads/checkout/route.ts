import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { billingRequestAckEmail, billingRequestEmail, SALES_INBOX, sendEmail } from '@/lib/email';
import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const inputSchema = z.object({
  region_id: z.string().uuid(),
  slot_type: z.enum(['featured', 'premium']),
});

const TIER_LABEL: Record<string, string> = {
  A_PLUS: 'A+',
  A: 'A',
  B_PLUS: 'B+',
  B: 'B',
};

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

/**
 * Self-serve ad slot reservation. Claims the first open slot of the requested
 * type in the region (scarcity is enforced by the DB partial unique index —
 * concurrent buyers race and exactly one wins each slot). Billing is
 * sales-led: the claim sits `pending` for up to 7 days while the team sets up
 * invoicing and activates it from /admin/billing. No card is collected in-app.
 *
 * Exclusive sponsorships are banded/negotiated, never self-serve — the sales
 * page routes those to contact.
 */
export async function POST(req: NextRequest) {
  if (!(await rateLimit('ads-checkout', { limit: 10, window: '60 s' })).success) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a moment.' }, { status: 429 });
  }

  const parsed = inputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const { region_id, slot_type } = parsed.data;

  // Caller must own a dispensary (RLS-backed lookup with their session).
  const { user, profile } = await getAuth();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  if (profile?.role !== 'dispensary_owner' && profile?.role !== 'admin') {
    return NextResponse.json(
      { error: 'Create a business account and claim your listing to advertise.' },
      { status: 403 },
    );
  }
  const supabase = await createClient();
  const { data: dispensary } = await supabase
    .from('dispensaries')
    .select('id, name')
    .eq('owner_id', user.id)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (!dispensary) {
    return NextResponse.json({ error: 'Create your dispensary listing first.' }, { status: 403 });
  }

  const service = createServiceClient();

  const { data: region } = await service
    .from('ad_regions')
    .select('id, slug, name, tier, is_active')
    .eq('id', region_id)
    .maybeSingle();
  if (!region || !region.is_active) {
    return NextResponse.json({ error: 'That region is unavailable.' }, { status: 404 });
  }

  const { data: product } = await service
    .from('ad_products')
    .select('id, launch_price')
    .eq('slot_type', slot_type)
    .eq('tier', region.tier)
    .maybeSingle();
  if (!product) {
    return NextResponse.json({ error: 'Pricing is not configured for this product.' }, { status: 500 });
  }

  // Free abandoned holds before looking for an open slot.
  await service.rpc('release_stale_ad_claims');

  // One live claim per slot per dispensary is also implied by the slot index;
  // don't let a shop double-request the same slot type in the same region.
  const { data: existing } = await service
    .from('ad_subscriptions')
    .select('id, slot:ad_slots!inner(region_id, slot_type)')
    .eq('dispensary_id', dispensary.id)
    .in('status', ['pending', 'active', 'past_due'])
    .eq('slot.region_id', region.id)
    .eq('slot.slot_type', slot_type)
    .limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: 'You already hold (or have requested) this slot type in this region.' },
      { status: 409 },
    );
  }

  // Candidate slots of this type in the region, in position order.
  const { data: slots } = await service
    .from('ad_slots')
    .select('id, position')
    .eq('region_id', region.id)
    .eq('slot_type', slot_type)
    .order('position');

  // Race for a slot: the claim_slot RPC raises SLOT_TAKEN when a slot has a
  // live subscription, so we simply try each in order. Two concurrent buyers
  // on the same last slot: exactly one insert wins, the loser gets 409.
  let subscriptionId: string | null = null;
  for (const slot of slots ?? []) {
    const { data, error } = await service.rpc('claim_slot', {
      p_slot_id: slot.id,
      p_dispensary_id: dispensary.id,
      p_price: product.launch_price,
    });
    if (!error && data) {
      subscriptionId = data;
      break;
    }
    if (error && !error.message.includes('SLOT_TAKEN')) {
      return NextResponse.json({ error: 'Could not reserve the slot.' }, { status: 500 });
    }
  }
  if (!subscriptionId) {
    return NextResponse.json(
      { error: 'SLOT_TAKEN', message: `All ${slot_type} slots in ${region.name} are taken.` },
      { status: 409 },
    );
  }

  // Slot is held — hand the request to sales for invoicing + activation.
  const kind = `${slot_type === 'featured' ? 'Featured' : 'Premium'} slot — ${region.name} (Tier ${TIER_LABEL[region.tier] ?? region.tier})`;
  const toSales = billingRequestEmail({
    kind,
    requester: dispensary.name,
    details: {
      Dispensary: dispensary.name,
      Region: region.name,
      Slot: slot_type,
      'Price / month': `$${(product.launch_price / 100).toFixed(2)}`,
    },
    siteUrl: siteUrl(),
  });
  await sendEmail({ to: SALES_INBOX, subject: toSales.subject, html: toSales.html });
  if (user.email) {
    const ack = billingRequestAckEmail(kind);
    await sendEmail({ to: user.email, subject: ack.subject, html: ack.html });
  }

  return NextResponse.json({
    ok: true,
    requested: true,
    message:
      'Slot reserved! Our team will contact you within 1 business day to set up billing — the slot is held for you for 7 days.',
  });
}
