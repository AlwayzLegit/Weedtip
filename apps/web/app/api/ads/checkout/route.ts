import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { isStripeConfigured, stripe } from '@/lib/stripe';
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
 * Self-serve ad slot checkout. Claims the first open slot of the requested
 * type in the region (scarcity is enforced by the DB partial unique index —
 * concurrent buyers race and exactly one wins each slot), then hands off to a
 * Stripe subscription Checkout. The webhook flips the claim to `active` on
 * payment; abandoned claims release after 30 minutes.
 *
 * Exclusive sponsorships are banded/negotiated, not self-serve — the sales
 * page routes those to contact.
 */
export async function POST(req: NextRequest) {
  if (!(await rateLimit('ads-checkout', { limit: 10, window: '60 s' })).success) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a moment.' }, { status: 429 });
  }
  if (!isStripeConfigured || !stripe) {
    return NextResponse.json({ error: 'Online billing is not enabled yet.' }, { status: 503 });
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
    .select('id, launch_price, stripe_price_id')
    .eq('slot_type', slot_type)
    .eq('tier', region.tier)
    .maybeSingle();
  if (!product) {
    return NextResponse.json({ error: 'Pricing is not configured for this product.' }, { status: 500 });
  }

  // Free abandoned holds before looking for an open slot.
  await service.rpc('release_stale_ad_claims');

  // One live claim per slot per dispensary is also implied by the slot index;
  // don't let a shop double-buy the same slot type in the same region.
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
      { error: 'You already hold (or are checking out) this slot type in this region.' },
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

  try {
    const meta = {
      kind: 'ad_slot',
      ad_subscription_id: subscriptionId,
      dispensary_id: dispensary.id,
      region_slug: region.slug,
      slot_type,
    };
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        product.stripe_price_id
          ? { quantity: 1, price: product.stripe_price_id }
          : {
              quantity: 1,
              price_data: {
                currency: 'usd',
                unit_amount: product.launch_price,
                recurring: { interval: 'month' },
                product_data: {
                  name: `${slot_type === 'featured' ? 'Featured' : 'Premium Listing'} — ${region.name} (Tier ${TIER_LABEL[region.tier] ?? region.tier})`,
                },
              },
            },
      ],
      client_reference_id: subscriptionId,
      metadata: meta,
      subscription_data: { metadata: meta },
      success_url: `${siteUrl()}/advertise/${region.slug}?billing=success`,
      cancel_url: `${siteUrl()}/advertise/${region.slug}?billing=cancelled`,
    });
    if (!session.url) throw new Error('Stripe did not return a checkout URL.');
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    // Payment couldn't start — release the hold immediately.
    await service
      .from('ad_subscriptions')
      .update({ status: 'canceled', ends_at: new Date().toISOString() })
      .eq('id', subscriptionId);
    const message = e instanceof Error ? e.message : 'Checkout failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
