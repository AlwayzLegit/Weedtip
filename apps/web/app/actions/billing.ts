'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  billingRequestAckEmail,
  billingRequestEmail,
  SALES_INBOX,
  sendEmail,
} from '@/lib/email';
import { notifyAdmins } from '@/lib/notify';
import { requireDispensaryOwner } from '@/lib/owner';
import {
  placementPriceCents,
  PLACEMENT_MAX_DAYS,
  PLACEMENT_MIN_DAYS,
  PLACEMENT_TYPE_LABEL,
  type PlacementType,
} from '@/lib/placement-pricing';
import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * B2B billing, sales-led. Weedtip never collects card payments in-app (and
 * never charges shoppers at all): every purchase intent creates a PENDING
 * record plus an email to the sales inbox, and the admin billing console
 * (/admin/billing) activates it once invoicing is arranged. When the
 * PaymentCloud gateway lands, activation becomes automatic — the pending
 * records and activation paths stay exactly the same.
 */

export type BillingRequestResult = { ok: true; message: string } | { ok: false; error: string };

const REQUEST_ACK =
  'Request received — our team will confirm details and set up billing within 1 business day.';

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

/** Notify sales + acknowledge the requester. Failures never block the request. */
async function sendBillingEmails(
  kind: string,
  requester: string,
  requesterEmail: string | null,
  details: Record<string, string | number>,
) {
  const toSales = billingRequestEmail({ kind, requester, details, siteUrl: siteUrl() });
  await sendEmail({ to: SALES_INBOX, subject: toSales.subject, html: toSales.html });
  if (requesterEmail) {
    const ack = billingRequestAckEmail(kind);
    await sendEmail({ to: requesterEmail, subject: ack.subject, html: ack.html });
  }
  // In-app heads-up to admins for every sales-led billing request.
  await notifyAdmins({
    type: 'billing_request',
    title: `Billing request — ${kind}`,
    body: `${requester} requested ${kind}.`,
    href: '/admin/billing',
  });
}

// ─── Plans ────────────────────────────────────────────────────────────────────

/**
 * Switch plans. Free is immediate (it's a downgrade — no billing to arrange);
 * a paid plan creates a pending subscription for the sales team to activate.
 */
export async function requestPlanChange(planId: string): Promise<BillingRequestResult> {
  const { dispensary } = await requireDispensaryOwner();
  // Keyed per dispensary, not per IP: requests are free to create, so the
  // requester identity is what needs throttling.
  if (!(await rateLimit('billing', { limit: 5, window: '60 s' }, dispensary.id)).success) {
    return { ok: false, error: 'Too many attempts. Please wait a moment.' };
  }
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from('plans')
    .select('id, slug, name, price_cents, is_active')
    .eq('id', planId)
    .maybeSingle();
  if (!plan || !plan.is_active) return { ok: false, error: 'That plan is unavailable.' };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Current subscription state — used to avoid demoting a paying customer.
  const { data: current } = await supabase
    .from('dispensary_subscriptions')
    .select('status, plan:plans(price_cents)')
    .eq('dispensary_id', dispensary.id)
    .maybeSingle();
  const onActivePaid =
    current?.status === 'active' &&
    ((current.plan as { price_cents: number } | null)?.price_cents ?? 0) > 0;

  const service = createServiceClient();

  // Downgrade to Free: immediate — clear the paid plan and its entitlements.
  if (plan.price_cents <= 0) {
    const { error } = await service.from('dispensary_subscriptions').upsert(
      {
        dispensary_id: dispensary.id,
        plan_id: plan.id,
        status: 'active',
        current_period_end: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'dispensary_id' },
    );
    if (error) return { ok: false, error: 'Could not change your plan.' };
    await service.rpc('grant_pos_addon', { p_dispensary_id: dispensary.id, p_enabled: false });
    revalidatePath('/dashboard/promote');
    return { ok: true, message: 'You are on the Free plan.' };
  }

  // Requesting a paid plan while ALREADY on an active paid plan: never flip the
  // live row to 'pending' — that would strip the perks they're paying for. Log
  // the change request for sales and leave the active subscription in force.
  if (onActivePaid) {
    await sendBillingEmails(`Plan change to ${plan.name}`, dispensary.name, user?.email ?? null, {
      Dispensary: dispensary.name,
      'New plan': plan.name,
      'Price / month': `$${(plan.price_cents / 100).toFixed(2)}`,
      Note: 'Already on an active paid plan — do not downgrade until the change is confirmed.',
    });
    revalidatePath('/dashboard/promote');
    return {
      ok: true,
      message: 'Change requested — your current plan stays active until our team confirms it.',
    };
  }

  const { error } = await service.from('dispensary_subscriptions').upsert(
    {
      dispensary_id: dispensary.id,
      plan_id: plan.id,
      status: 'pending',
      current_period_end: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'dispensary_id' },
  );
  if (error) return { ok: false, error: 'Could not submit your plan request.' };

  await sendBillingEmails(`${plan.name} plan subscription`, dispensary.name, user?.email ?? null, {
    Dispensary: dispensary.name,
    Plan: plan.name,
    'Price / month': `$${(plan.price_cents / 100).toFixed(2)}`,
  });
  revalidatePath('/dashboard/promote');
  return { ok: true, message: REQUEST_ACK };
}

/** Cancel the paid plan — immediate, no money involved until the gateway era. */
export async function cancelPlan(): Promise<BillingRequestResult> {
  const { dispensary } = await requireDispensaryOwner();
  const service = createServiceClient();
  const { error } = await service
    .from('dispensary_subscriptions')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('dispensary_id', dispensary.id);
  if (error) return { ok: false, error: 'Could not cancel your plan.' };
  await service.rpc('grant_pos_addon', { p_dispensary_id: dispensary.id, p_enabled: false });

  await sendEmail({
    to: SALES_INBOX,
    subject: `[Billing] Plan canceled — ${dispensary.name}`,
    html: `<p>${dispensary.name} canceled their paid plan.</p>`,
  });
  revalidatePath('/dashboard/promote');
  return { ok: true, message: 'Your plan has been canceled.' };
}

// ─── One-time placements (dispensary) ─────────────────────────────────────────

const placementSchema = z.object({
  type: z.enum(['featured', 'hero', 'promoted_deal', 'promoted_product']),
  scope: z.enum(['city', 'state', 'nationwide']),
  days: z.number().int().min(PLACEMENT_MIN_DAYS).max(PLACEMENT_MAX_DAYS),
  target_id: z.string().uuid().optional(),
});
export type RequestPlacementInput = z.infer<typeof placementSchema>;

/**
 * Reserve a one-time, time-boxed placement. Creates a PENDING placement
 * (is_active = false) priced from the rate card; the admin billing console
 * activates it once billing is arranged.
 */
export async function requestPlacement(raw: RequestPlacementInput): Promise<BillingRequestResult> {
  const parsed = placementSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid request.' };
  const input = parsed.data;

  if ((input.type === 'promoted_deal' || input.type === 'promoted_product') && !input.target_id) {
    return { ok: false, error: 'Select which item to promote.' };
  }

  const { dispensary } = await requireDispensaryOwner();
  if (!(await rateLimit('billing', { limit: 5, window: '60 s' }, dispensary.id)).success) {
    return { ok: false, error: 'Too many attempts. Please wait a moment.' };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Cap open (never-activated) requests so the console and sales inbox can't
  // be flooded with free-to-create pending placements.
  const { count: openReqs } = await supabase
    .from('placements')
    .select('id', { count: 'exact', head: true })
    .eq('dispensary_id', dispensary.id)
    .eq('status', 'pending');
  if ((openReqs ?? 0) >= 5) {
    return {
      ok: false,
      error: 'You already have 5 placement requests awaiting our team — we’ll be in touch shortly.',
    };
  }

  const scope_state = input.scope === 'nationwide' ? null : dispensary.state;
  const scope_city = input.scope === 'city' ? dispensary.city : null;
  const priceCents = placementPriceCents(input.type, input.scope, input.days);

  // Service client: placement writes are admin-only under RLS, and we've
  // already authorized the owner against their own dispensary.
  const service = createServiceClient();
  const { error: insErr } = await service.from('placements').insert({
    dispensary_id: dispensary.id,
    type: input.type,
    target_id: input.target_id ?? null,
    scope_state,
    scope_city,
    is_active: false,
    status: 'pending',
    price_cents: priceCents,
    notes: `Self-serve request · ${input.days} day${input.days === 1 ? '' : 's'}`,
  });
  if (insErr) return { ok: false, error: 'Could not create the placement request.' };

  await sendBillingEmails(
    PLACEMENT_TYPE_LABEL[input.type],
    dispensary.name,
    user?.email ?? null,
    {
      Dispensary: dispensary.name,
      Placement: PLACEMENT_TYPE_LABEL[input.type],
      Reach: input.scope,
      Days: input.days,
      Price: `$${(priceCents / 100).toFixed(2)}`,
    },
  );
  revalidatePath('/dashboard/promote');
  return { ok: true, message: REQUEST_ACK };
}

// ─── Brand promotions ─────────────────────────────────────────────────────────

const brandPlacementSchema = z.object({
  brand_id: z.string().uuid(),
  days: z.number().int().min(PLACEMENT_MIN_DAYS).max(PLACEMENT_MAX_DAYS),
  state: z
    .string()
    .trim()
    .length(2)
    .transform((s) => s.toUpperCase())
    .optional(),
});
export type RequestBrandPlacementInput = z.infer<typeof brandPlacementSchema>;

/** Reserve a promoted-brand placement (nationwide or one state). */
export async function requestBrandPlacement(
  raw: RequestBrandPlacementInput,
): Promise<BillingRequestResult> {
  const parsed = brandPlacementSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid request.' };
  }
  const input = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };
  if (!(await rateLimit('billing', { limit: 5, window: '60 s' }, user.id)).success) {
    return { ok: false, error: 'Too many attempts. Please wait a moment.' };
  }

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, owner_id')
    .eq('id', input.brand_id)
    .maybeSingle();
  if (!brand || brand.owner_id !== user.id) {
    return { ok: false, error: 'You do not own this brand.' };
  }

  // Same open-request cap as dispensary placements.
  const { count: openReqs } = await supabase
    .from('placements')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brand.id)
    .eq('status', 'pending');
  if ((openReqs ?? 0) >= 5) {
    return {
      ok: false,
      error: 'You already have 5 promotion requests awaiting our team — we’ll be in touch shortly.',
    };
  }

  const scope = input.state ? 'state' : 'nationwide';
  const priceCents = placementPriceCents('promoted_brand', scope, input.days);
  const where = input.state ? input.state : 'Nationwide';

  const service = createServiceClient();
  const { error: insErr } = await service.from('placements').insert({
    brand_id: brand.id,
    type: 'promoted_brand',
    scope_state: input.state ?? null,
    is_active: false,
    status: 'pending',
    price_cents: priceCents,
    notes: `Self-serve brand promo request · ${where} · ${input.days} day${input.days === 1 ? '' : 's'}`,
  });
  if (insErr) return { ok: false, error: 'Could not create the placement request.' };

  await sendBillingEmails('Promoted brand', brand.name, user.email ?? null, {
    Brand: brand.name,
    Reach: where,
    Days: input.days,
    Price: `$${(priceCents / 100).toFixed(2)}`,
  });
  revalidatePath('/studio/promote');
  return { ok: true, message: REQUEST_ACK };
}

// ─── Brand featured-auction bids ──────────────────────────────────────────────

const brandBidSchema = z.object({
  brand_id: z.string().uuid(),
  region_id: z.string().uuid(),
  bid_cents: z.number().int().min(50).max(100_000_00),
});
export type RequestBrandBidInput = z.infer<typeof brandBidSchema>;

/**
 * Place a featured-auction bid. Verifies brand ownership + the market floor,
 * creates a PENDING bid; the admin console activates it (activate_brand_bid)
 * once billing for the 2-month term is arranged.
 */
export async function requestBrandBid(raw: RequestBrandBidInput): Promise<BillingRequestResult> {
  const parsed = brandBidSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid request.' };
  }
  const input = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };
  if (!(await rateLimit('billing', { limit: 5, window: '60 s' }, user.id)).success) {
    return { ok: false, error: 'Too many attempts. Please wait a moment.' };
  }

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, owner_id')
    .eq('id', input.brand_id)
    .maybeSingle();
  if (!brand || brand.owner_id !== user.id) {
    return { ok: false, error: 'You do not own this brand.' };
  }

  const { data: region } = await supabase
    .from('brand_ad_regions')
    .select('id, name, featured_rate_cents, is_active')
    .eq('id', input.region_id)
    .maybeSingle();
  if (!region || !region.is_active) return { ok: false, error: 'That market is unavailable.' };
  if (input.bid_cents < region.featured_rate_cents) {
    return { ok: false, error: 'Bid is below the market floor.' };
  }

  // Clear any stale pending bid, then create a fresh one (service client: bid
  // writes are admin-only under RLS and ownership is verified above).
  const service = createServiceClient();
  await service
    .from('brand_ad_bids')
    .delete()
    .eq('brand_id', brand.id)
    .eq('region_id', region.id)
    .eq('status', 'pending');
  const placeholderEnd = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const { error: insErr } = await service.from('brand_ad_bids').insert({
    region_id: region.id,
    brand_id: brand.id,
    bid_cents: input.bid_cents,
    status: 'pending',
    contract_end: placeholderEnd,
  });
  if (insErr) return { ok: false, error: 'Could not create the bid.' };

  await sendBillingEmails('Featured brand bid', brand.name, user.email ?? null, {
    Brand: brand.name,
    Market: region.name,
    'Bid (2-month term)': `$${(input.bid_cents / 100).toFixed(2)}`,
  });
  revalidatePath('/studio/bids');
  return { ok: true, message: REQUEST_ACK };
}

// Re-export the type for callers that map over placement types.
export type { PlacementType };
