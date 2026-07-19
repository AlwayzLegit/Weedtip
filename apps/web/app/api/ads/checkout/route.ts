import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { billingRequestAckEmail, billingRequestEmail, SALES_INBOX, sendEmail } from '@/lib/email';
import { notifyAdmins } from '@/lib/notify';
import { promotionGate } from '@/lib/promotion-gate';
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
  const parsed = inputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const { region_id, slot_type } = parsed.data;

  // Caller must own a dispensary (RLS-backed lookup with their session).
  const { user, profile } = await getAuth();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  // Rate-limit per USER, not per IP: without payment up front, held slots are
  // the thing being spent — don't let one account machine-gun reservations.
  if (!(await rateLimit('ads-checkout', { limit: 3, window: '60 s' }, user.id)).success) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a moment.' }, { status: 429 });
  }
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

  // Tiered setup: advertising unlocks once the listing basics are done — a
  // half-empty listing in a paid slot burns the buyer's money.
  const gate = await promotionGate(dispensary.id);
  if (!gate.unlocked) {
    return NextResponse.json(
      {
        error: `Finish setting up your listing to unlock advertising: ${gate.missing.join(', ')}.`,
      },
      { status: 403 },
    );
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

  // Dynamic step pricing: every live PAID claim in this region+type raises the
  // next spot ~15%, capped at list price. The buyer pays TODAY's step price.
  const { data: stepPrice } = await service.rpc('slot_price_cents', {
    p_region_id: region.id,
    p_slot_type: slot_type,
  });
  const priceCents = typeof stepPrice === 'number' && stepPrice > 0 ? stepPrice : product.launch_price;

  // Free abandoned holds before looking for an open slot.
  await service.rpc('release_stale_ad_claims');

  // Unpaid holds are free to create, so cap them: without this, one shop
  // could squat a featured + premium slot in every region nationwide for a
  // week and lock competitors out of scarce inventory.
  const { count: openHolds } = await service
    .from('ad_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('dispensary_id', dispensary.id)
    .eq('status', 'pending');
  if ((openHolds ?? 0) >= 5) {
    return NextResponse.json(
      {
        error:
          'You already have 5 slot reservations awaiting billing. Complete those with our team first, or wait for them to release.',
      },
      { status: 429 },
    );
  }

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
  const tryClaim = async (): Promise<string | null> => {
    for (const slot of slots ?? []) {
      const { data, error } = await service.rpc('claim_slot', {
        p_slot_id: slot.id,
        p_dispensary_id: dispensary.id,
        p_price: priceCents,
      });
      if (!error && data) return data;
      if (error && !error.message.includes('SLOT_TAKEN')) {
        throw new Error('claim failed');
      }
    }
    return null;
  };

  let subscriptionId: string | null = null;
  try {
    subscriptionId = await tryClaim();
    if (!subscriptionId) {
      // Cold-start rule: a PAID claim always preempts a house fill. Release
      // the lowest-priority house sub in this region+type, then claim again.
      const { data: house } = await service
        .from('ad_subscriptions')
        .select('id, slot:ad_slots!inner(region_id, slot_type, position)')
        .eq('is_house', true)
        .in('status', ['active', 'pending'])
        .eq('slot.region_id', region.id)
        .eq('slot.slot_type', slot_type)
        .order('created_at', { ascending: false })
        .limit(1);
      if (house && house.length > 0) {
        await service
          .from('ad_subscriptions')
          .update({ status: 'canceled', ends_at: new Date().toISOString() })
          .eq('id', house[0]!.id);
        subscriptionId = await tryClaim();
      }
    }
  } catch {
    return NextResponse.json({ error: 'Could not reserve the slot.' }, { status: 500 });
  }
  if (!subscriptionId) {
    // Genuinely sold out (all paid) — waitlist it as an in-admin request
    // instead of a dead end. Duplicate requests no-op via the unique key.
    // Re-open a previously resolved/dismissed request too - the buyer is
    // being told "you're on the list", so the row must actually be open.
    await service
      .from('ad_requests')
      .upsert(
        {
          dispensary_id: dispensary.id,
          region_id: region.id,
          slot_type,
          kind: 'availability',
          status: 'open',
        },
        { onConflict: 'dispensary_id,region_id,slot_type,kind' },
      );
    await notifyAdmins({
      type: 'ad_request',
      title: `Waitlist: ${slot_type} in ${region.name}`,
      body: `${dispensary.name} wants a ${slot_type} spot in ${region.name} — inventory is sold out.`,
      href: '/admin/ads-desk',
    });
    return NextResponse.json(
      {
        error: 'SLOT_TAKEN',
        message: `All ${slot_type} spots in ${region.name} are taken — you're on the list. We'll reach out the moment one opens.`,
      },
      { status: 409 },
    );
  }

  // Prompt the admin desk (email below is just a copy for the inbox).
  await notifyAdmins({
    type: 'ad_hold',
    title: `New ${slot_type} slot hold — ${region.name}`,
    body: `${dispensary.name} reserved a ${slot_type} spot at $${(priceCents / 100).toFixed(2)}/mo. Activate it from the Ad desk.`,
    href: '/admin/ads-desk',
  });

  // Slot is held — hand the request to sales for invoicing + activation.
  const kind = `${slot_type === 'featured' ? 'Featured' : 'Premium'} slot — ${region.name} (Tier ${TIER_LABEL[region.tier] ?? region.tier})`;
  const toSales = billingRequestEmail({
    kind,
    requester: dispensary.name,
    details: {
      Dispensary: dispensary.name,
      Region: region.name,
      Slot: slot_type,
      'Price / month': `$${(priceCents / 100).toFixed(2)}`,
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
