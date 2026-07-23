'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { billingRequestAckEmail, billingRequestEmail, SALES_INBOX, sendEmail } from '@/lib/email';
import { notifyAdmins } from '@/lib/notify';
import { requireDispensaryOwner } from '@/lib/owner';
import {
  placementPriceCents,
  PLACEMENT_MAX_DAYS,
  PLACEMENT_MIN_DAYS,
  PLACEMENT_TYPE_LABEL,
  type PlacementType,
} from '@/lib/placement-pricing';
import { promotionGate } from '@/lib/promotion-gate';
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

/**
 * Brand equivalent of requestPlanChange. Brands run on the same plans ladder;
 * Basic unlocks the working Brand Studio (catalog, analytics, updates, complete
 * profile). Sales-led: paid requests land as a pending brand_subscription for
 * /admin/billing to activate.
 */
export async function requestBrandPlanChange(
  brandId: string,
  planId: string,
): Promise<BillingRequestResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, owner_id')
    .eq('id', brandId)
    .maybeSingle();
  if (!brand || brand.owner_id !== user.id)
    return { ok: false, error: 'You do not own this brand.' };

  if (!(await rateLimit('billing', { limit: 5, window: '60 s' }, brand.id)).success) {
    return { ok: false, error: 'Too many attempts. Please wait a moment.' };
  }

  const { data: plan } = await supabase
    .from('plans')
    .select('id, name, price_cents, is_active')
    .eq('id', planId)
    .maybeSingle();
  if (!plan || !plan.is_active) return { ok: false, error: 'That plan is unavailable.' };

  const service = createServiceClient();

  const { data: current } = await supabase
    .from('brand_subscriptions')
    .select('status, plan:plans(price_cents)')
    .eq('brand_id', brand.id)
    .maybeSingle();
  const onActivePaid =
    current?.status === 'active' &&
    ((current.plan as { price_cents: number } | null)?.price_cents ?? 0) > 0;

  // Downgrade to Free is immediate.
  if (plan.price_cents <= 0) {
    const { error } = await service.from('brand_subscriptions').upsert(
      {
        brand_id: brand.id,
        plan_id: plan.id,
        status: 'active',
        current_period_end: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'brand_id' },
    );
    if (error) return { ok: false, error: 'Could not change your plan.' };
    revalidatePath('/studio');
    return { ok: true, message: 'You are on the Free plan.' };
  }

  // Never flip a live paid row to pending — leave it active, log the change.
  if (onActivePaid) {
    await sendBillingEmails(`Brand plan change to ${plan.name}`, brand.name, user.email ?? null, {
      Brand: brand.name,
      'New plan': plan.name,
      'Price / month': `$${(plan.price_cents / 100).toFixed(2)}`,
      Note: 'Already on an active paid plan — do not downgrade until confirmed.',
    });
    revalidatePath('/studio');
    return {
      ok: true,
      message: 'Change requested — your current plan stays active until our team confirms it.',
    };
  }

  const { error } = await service.from('brand_subscriptions').upsert(
    {
      brand_id: brand.id,
      plan_id: plan.id,
      status: 'pending',
      current_period_end: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'brand_id' },
  );
  if (error) return { ok: false, error: 'Could not submit your plan request.' };

  await sendBillingEmails(`${plan.name} brand plan subscription`, brand.name, user.email ?? null, {
    Brand: brand.name,
    Plan: plan.name,
    'Price / month': `$${(plan.price_cents / 100).toFixed(2)}`,
  });
  revalidatePath('/studio');
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
  /** Optional creative from the shop's library — rendered on the ad surface. */
  creative_id: z.string().uuid().optional(),
  /** Optional scheduled start (YYYY-MM-DD, today..+90d); blank = on activation. */
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
export type RequestPlacementInput = z.infer<typeof placementSchema>;

/**
 * Reserve a one-time, time-boxed placement. Creates a PENDING placement
 * (is_active = false) priced from the rate card; the admin billing console
 * activates it once billing is arranged.
 */
export async function requestPlacement(raw: RequestPlacementInput): Promise<BillingRequestResult> {
  const parsed = placementSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid request.' };
  const input = parsed.data;

  if ((input.type === 'promoted_deal' || input.type === 'promoted_product') && !input.target_id) {
    return { ok: false, error: 'Select which item to promote.' };
  }

  const { dispensary } = await requireDispensaryOwner();
  if (!(await rateLimit('billing', { limit: 5, window: '60 s' }, dispensary.id)).success) {
    return { ok: false, error: 'Too many attempts. Please wait a moment.' };
  }

  // Tiered setup: promotion unlocks once the listing basics are complete.
  const gate = await promotionGate(dispensary.id);
  if (!gate.unlocked) {
    return {
      ok: false,
      error: `Finish setting up your listing to unlock promotion: ${gate.missing.join(', ')}.`,
    };
  }

  // Scheduled start must be today..+90 days (activation clamps to "not past").
  if (input.start_date) {
    const start = new Date(`${input.start_date}T00:00:00Z`).getTime();
    const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime();
    if (Number.isNaN(start) || start < today || start > today + 90 * 86_400_000) {
      return { ok: false, error: 'Start date must be within the next 90 days.' };
    }
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

  // An attached creative must belong to this shop's library.
  if (input.creative_id) {
    const { data: creative } = await supabase
      .from('ad_creatives')
      .select('id')
      .eq('id', input.creative_id)
      .eq('dispensary_id', dispensary.id)
      .maybeSingle();
    if (!creative) return { ok: false, error: 'That creative is not in your library.' };
  }

  // Service client: placement writes are admin-only under RLS, and we've
  // already authorized the owner against their own dispensary.
  const service = createServiceClient();
  const { error: insErr } = await service.from('placements').insert({
    dispensary_id: dispensary.id,
    type: input.type,
    target_id: input.target_id ?? null,
    creative_id: input.creative_id ?? null,
    requested_start: input.start_date ?? null,
    scope_state,
    scope_city,
    is_active: false,
    status: 'pending',
    price_cents: priceCents,
    notes: `Self-serve request · ${input.days} day${input.days === 1 ? '' : 's'}${
      input.start_date ? ` · starts ${input.start_date}` : ''
    }`,
  });
  if (insErr) return { ok: false, error: 'Could not create the placement request.' };

  await sendBillingEmails(PLACEMENT_TYPE_LABEL[input.type], dispensary.name, user?.email ?? null, {
    Dispensary: dispensary.name,
    Placement: PLACEMENT_TYPE_LABEL[input.type],
    Reach: input.scope,
    Days: input.days,
    Price: `$${(priceCents / 100).toFixed(2)}`,
  });
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
  /** Optional city targeting — only valid alongside a state (city > state > nationwide). */
  city: z.string().trim().min(1).max(80).optional(),
  /** Optional creative from the brand's library — its art/headline render on the
   *  ad surface instead of the plain brand logo. */
  creative_id: z.string().uuid().optional(),
  /** 'promoted_brand' features the brand on the Brands directory; 'hero' buys a
   *  homepage carousel slot (brands rank alongside dispensaries). */
  type: z.enum(['promoted_brand', 'hero']).default('promoted_brand'),
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

  // City targeting needs a state (the hero serving keys city match on state).
  if (input.city && !input.state) {
    return { ok: false, error: 'Pick a state to target a specific city.' };
  }

  // An attached creative must belong to THIS brand's library.
  if (input.creative_id) {
    const service = createServiceClient();
    const { data: creative } = await service
      .from('ad_creatives')
      .select('id')
      .eq('id', input.creative_id)
      .eq('brand_id', brand.id)
      .maybeSingle();
    if (!creative) return { ok: false, error: 'That creative is not in your library.' };
  }

  const scope = input.city ? 'city' : input.state ? 'state' : 'nationwide';
  const priceCents = placementPriceCents(input.type, scope, input.days);
  const where = input.city ? `${input.city}, ${input.state}` : (input.state ?? 'Nationwide');
  const label = input.type === 'hero' ? 'Homepage hero' : 'Promoted brand';

  const service = createServiceClient();
  const { error: insErr } = await service.from('placements').insert({
    brand_id: brand.id,
    type: input.type,
    scope_state: input.state ?? null,
    scope_city: input.city ?? null,
    creative_id: input.creative_id ?? null,
    is_active: false,
    status: 'pending',
    price_cents: priceCents,
    notes: `Self-serve brand ${input.type === 'hero' ? 'hero' : 'promo'} request · ${where} · ${input.days} day${input.days === 1 ? '' : 's'}`,
  });
  if (insErr) return { ok: false, error: 'Could not create the placement request.' };

  await sendBillingEmails(label, brand.name, user.email ?? null, {
    Brand: brand.name,
    Reach: where,
    Days: input.days,
    Price: `$${(priceCents / 100).toFixed(2)}`,
    ...(input.creative_id ? { Creative: 'Custom creative attached' } : {}),
  });
  revalidatePath('/studio/promote');
  return { ok: true, message: REQUEST_ACK };
}

// ─── Region merch-slot reservations (brand + product self-serve) ──────────────
// Featured brands/products are now sold on the unified region ad-slot system
// (ad_subscriptions), not the legacy promoted_brand/promoted_product placements.
// A reservation is the same sales-led request→admin flow: it holds the next open
// NATIONWIDE slot as a PENDING subscription, emails sales, and the admin
// activates it (or re-targets it to a metro region) in the merch desk.

/** Claim the next open nationwide slot of a type, or explain why none is free. */
async function reserveNextNationwideSlot(
  service: ReturnType<typeof createServiceClient>,
  slotType: 'brand' | 'product' | 'hero',
): Promise<{ slotId: string } | { error: string }> {
  const { data: region } = await service
    .from('ad_regions')
    .select('id')
    .eq('slug', 'nationwide')
    .maybeSingle();
  if (!region) return { error: 'Merchandising is not set up yet — please contact support.' };
  const { data: slots } = await service
    .from('ad_slots')
    .select('id, position')
    .eq('region_id', region.id)
    .eq('slot_type', slotType)
    .order('position');
  if (!slots?.length) return { error: 'No featured slots are configured right now.' };
  const { data: live } = await service
    .from('ad_subscriptions')
    .select('slot_id')
    .in(
      'slot_id',
      slots.map((s) => s.id),
    )
    .in('status', ['pending', 'active', 'past_due']);
  const taken = new Set((live ?? []).map((s) => s.slot_id));
  const open = slots.find((s) => !taken.has(s.id));
  if (!open) {
    return { error: 'All featured slots are reserved right now — please check back soon.' };
  }
  return { slotId: open.id };
}

const reserveBrandSchema = z.object({
  brand_id: z.string().uuid(),
  days: z.number().int().min(PLACEMENT_MIN_DAYS).max(PLACEMENT_MAX_DAYS),
  creative_id: z.string().uuid().optional(),
});
export type ReserveBrandSlotInput = z.infer<typeof reserveBrandSchema>;

/** Reserve a featured-brand region slot (pending until the team activates it). */
export async function reserveBrandSlot(raw: ReserveBrandSlotInput): Promise<BillingRequestResult> {
  const parsed = reserveBrandSchema.safeParse(raw);
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

  const service = createServiceClient();

  // Cap open (pending) reservations per brand so held slots can't be hoarded.
  const { count: openReqs } = await service
    .from('ad_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brand.id)
    .eq('status', 'pending');
  if ((openReqs ?? 0) >= 3) {
    return {
      ok: false,
      error: 'You already have reservations awaiting our team — we’ll be in touch shortly.',
    };
  }

  if (input.creative_id) {
    const { data: creative } = await service
      .from('ad_creatives')
      .select('id')
      .eq('id', input.creative_id)
      .eq('brand_id', brand.id)
      .maybeSingle();
    if (!creative) return { ok: false, error: 'That creative is not in your library.' };
  }

  const slot = await reserveNextNationwideSlot(service, 'brand');
  if ('error' in slot) return { ok: false, error: slot.error };

  const now = new Date();
  const ends = new Date(now.getTime() + input.days * 86_400_000);
  const priceCents = placementPriceCents('promoted_brand', 'nationwide', input.days);
  const { error: insErr } = await service.from('ad_subscriptions').insert({
    slot_id: slot.slotId,
    brand_id: brand.id,
    creative_id: input.creative_id ?? null,
    price_paid: priceCents,
    status: 'pending',
    is_house: false,
    starts_at: now.toISOString(),
    ends_at: ends.toISOString(),
  });
  if (insErr) return { ok: false, error: 'Could not create the reservation.' };

  await sendBillingEmails('Featured brand', brand.name, user.email ?? null, {
    Brand: brand.name,
    Reach: 'Nationwide (team can target a metro)',
    Days: input.days,
    Price: `$${(priceCents / 100).toFixed(2)}`,
    ...(input.creative_id ? { Creative: 'Custom creative attached' } : {}),
  });
  revalidatePath('/studio/promote');
  return { ok: true, message: REQUEST_ACK };
}

const reserveProductSchema = z.object({
  product_id: z.string().uuid(),
  days: z.number().int().min(PLACEMENT_MIN_DAYS).max(PLACEMENT_MAX_DAYS),
});
export type ReserveProductSlotInput = z.infer<typeof reserveProductSchema>;

/** Reserve a featured-product region slot for one of your shop's products. */
export async function reserveProductSlot(
  raw: ReserveProductSlotInput,
): Promise<BillingRequestResult> {
  const parsed = reserveProductSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid request.' };
  }
  const input = parsed.data;

  const { dispensary } = await requireDispensaryOwner();
  if (!(await rateLimit('billing', { limit: 5, window: '60 s' }, dispensary.id)).success) {
    return { ok: false, error: 'Too many attempts. Please wait a moment.' };
  }

  const service = createServiceClient();
  const { data: product } = await service
    .from('products')
    .select('id, name, dispensary_id')
    .eq('id', input.product_id)
    .maybeSingle();
  if (!product || product.dispensary_id !== dispensary.id) {
    return { ok: false, error: 'That product is not on your menu.' };
  }

  // Cap open (pending) product reservations for this shop.
  const { count: openReqs } = await service
    .from('ad_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('dispensary_id', dispensary.id)
    .not('product_id', 'is', null)
    .eq('status', 'pending');
  if ((openReqs ?? 0) >= 3) {
    return {
      ok: false,
      error: 'You already have reservations awaiting our team — we’ll be in touch shortly.',
    };
  }

  const slot = await reserveNextNationwideSlot(service, 'product');
  if ('error' in slot) return { ok: false, error: slot.error };

  const now = new Date();
  const ends = new Date(now.getTime() + input.days * 86_400_000);
  const priceCents = placementPriceCents('promoted_product', 'nationwide', input.days);
  const { error: insErr } = await service.from('ad_subscriptions').insert({
    slot_id: slot.slotId,
    dispensary_id: dispensary.id,
    product_id: product.id,
    price_paid: priceCents,
    status: 'pending',
    is_house: false,
    starts_at: now.toISOString(),
    ends_at: ends.toISOString(),
  });
  if (insErr) return { ok: false, error: 'Could not create the reservation.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await sendBillingEmails('Featured product', dispensary.name, user?.email ?? null, {
    Dispensary: dispensary.name,
    Product: product.name,
    Reach: 'Nationwide (team can target a metro)',
    Days: input.days,
    Price: `$${(priceCents / 100).toFixed(2)}`,
  });
  revalidatePath('/dashboard/promote');
  return { ok: true, message: REQUEST_ACK };
}

// ─── Homepage hero reservations (region hero slots) ──────────────────────────
// The hero is a region ad-slot type too; brands and dispensaries reserve a hero
// slot the same request→admin way. Advertiser is the brand (from the studio) or
// the shop (from the dashboard); both hold the next open nationwide hero slot as
// a pending subscription until the team activates it.

const reserveHeroBrandSchema = z.object({
  brand_id: z.string().uuid(),
  days: z.number().int().min(PLACEMENT_MIN_DAYS).max(PLACEMENT_MAX_DAYS),
  creative_id: z.string().uuid().optional(),
});
export type ReserveHeroBrandInput = z.infer<typeof reserveHeroBrandSchema>;

/** Reserve a homepage hero slot for a brand (pending until the team activates). */
export async function reserveHeroSlotForBrand(
  raw: ReserveHeroBrandInput,
): Promise<BillingRequestResult> {
  const parsed = reserveHeroBrandSchema.safeParse(raw);
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

  const service = createServiceClient();
  const { count: openReqs } = await service
    .from('ad_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brand.id)
    .eq('status', 'pending');
  if ((openReqs ?? 0) >= 3) {
    return {
      ok: false,
      error: 'You already have reservations awaiting our team — we’ll be in touch shortly.',
    };
  }

  if (input.creative_id) {
    const { data: creative } = await service
      .from('ad_creatives')
      .select('id')
      .eq('id', input.creative_id)
      .eq('brand_id', brand.id)
      .maybeSingle();
    if (!creative) return { ok: false, error: 'That creative is not in your library.' };
  }

  const slot = await reserveNextNationwideSlot(service, 'hero');
  if ('error' in slot) return { ok: false, error: slot.error };

  const now = new Date();
  const ends = new Date(now.getTime() + input.days * 86_400_000);
  const priceCents = placementPriceCents('hero', 'nationwide', input.days);
  const { error: insErr } = await service.from('ad_subscriptions').insert({
    slot_id: slot.slotId,
    brand_id: brand.id,
    creative_id: input.creative_id ?? null,
    price_paid: priceCents,
    status: 'pending',
    is_house: false,
    starts_at: now.toISOString(),
    ends_at: ends.toISOString(),
  });
  if (insErr) return { ok: false, error: 'Could not create the reservation.' };

  await sendBillingEmails('Homepage hero', brand.name, user.email ?? null, {
    Brand: brand.name,
    Reach: 'Nationwide (team can target a metro)',
    Days: input.days,
    Price: `$${(priceCents / 100).toFixed(2)}`,
    ...(input.creative_id ? { Creative: 'Custom creative attached' } : {}),
  });
  revalidatePath('/studio/promote');
  return { ok: true, message: REQUEST_ACK };
}

const reserveHeroShopSchema = z.object({
  days: z.number().int().min(PLACEMENT_MIN_DAYS).max(PLACEMENT_MAX_DAYS),
  creative_id: z.string().uuid().optional(),
});
export type ReserveHeroShopInput = z.infer<typeof reserveHeroShopSchema>;

/** Reserve a homepage hero slot for the owner's dispensary. */
export async function reserveHeroSlotForShop(
  raw: ReserveHeroShopInput,
): Promise<BillingRequestResult> {
  const parsed = reserveHeroShopSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid request.' };
  }
  const input = parsed.data;

  const { dispensary } = await requireDispensaryOwner();
  if (!(await rateLimit('billing', { limit: 5, window: '60 s' }, dispensary.id)).success) {
    return { ok: false, error: 'Too many attempts. Please wait a moment.' };
  }

  const service = createServiceClient();
  const { count: openReqs } = await service
    .from('ad_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('dispensary_id', dispensary.id)
    .is('product_id', null)
    .eq('status', 'pending');
  if ((openReqs ?? 0) >= 3) {
    return {
      ok: false,
      error: 'You already have reservations awaiting our team — we’ll be in touch shortly.',
    };
  }

  if (input.creative_id) {
    const { data: creative } = await service
      .from('ad_creatives')
      .select('id')
      .eq('id', input.creative_id)
      .eq('dispensary_id', dispensary.id)
      .maybeSingle();
    if (!creative) return { ok: false, error: 'That creative is not in your library.' };
  }

  const slot = await reserveNextNationwideSlot(service, 'hero');
  if ('error' in slot) return { ok: false, error: slot.error };

  const now = new Date();
  const ends = new Date(now.getTime() + input.days * 86_400_000);
  const priceCents = placementPriceCents('hero', 'nationwide', input.days);
  const { error: insErr } = await service.from('ad_subscriptions').insert({
    slot_id: slot.slotId,
    dispensary_id: dispensary.id,
    creative_id: input.creative_id ?? null,
    price_paid: priceCents,
    status: 'pending',
    is_house: false,
    starts_at: now.toISOString(),
    ends_at: ends.toISOString(),
  });
  if (insErr) return { ok: false, error: 'Could not create the reservation.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await sendBillingEmails('Homepage hero', dispensary.name, user?.email ?? null, {
    Dispensary: dispensary.name,
    Reach: 'Nationwide (team can target a metro)',
    Days: input.days,
    Price: `$${(priceCents / 100).toFixed(2)}`,
  });
  revalidatePath('/dashboard/promote');
  return { ok: true, message: REQUEST_ACK };
}

// The brand featured-auction (requestBrandBid / brand_ad_bids) was folded into
// the region brand-slot system — brands reserve a Featured Brands slot from the
// studio Promote page now (reserveBrandSlot). The auction advertiser flow was
// already mothballed; its live bid was migrated to a region slot.

// Re-export the type for callers that map over placement types.
export type { PlacementType };
