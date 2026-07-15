'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  DEFAULT_MIN_AGE,
  DISPENSARY_STATUSES,
  STRAIN_TYPES,
  type DispensaryStatus,
} from '@weedtip/shared';
import { brandClaimDecisionEmail, claimDecisionEmail, sendEmail } from '@/lib/email';
import { notifyUser } from '@/lib/notify';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { slugify } from '@/lib/utils';
import { bool, formError, fromZodError, numOpt, str, type FormState } from '@/lib/forms';
import { z } from 'zod';

/** datetime-local string → ISO, or undefined if blank/invalid. */
function toIso(local: string | undefined): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

// ─── Dispensary moderation ───────────────────────────────────────────────────

export async function setDispensaryStatus(id: string, status: string): Promise<void> {
  if (!DISPENSARY_STATUSES.includes(status as DispensaryStatus)) return;
  const supabase = await createClient();
  // RLS + the enforce_dispensary_admin_fields trigger permit this only for admins.
  const { data: shop } = await supabase
    .from('dispensaries')
    .update({ status: status as DispensaryStatus })
    .eq('id', id)
    .select('name, slug, owner_id')
    .maybeSingle();

  // Let a claimed shop's owner know when their listing goes live or is suspended.
  if (shop?.owner_id && (status === 'active' || status === 'suspended')) {
    await notifyUser(shop.owner_id, {
      type: 'listing_status',
      title:
        status === 'active' ? `${shop.name} is now live` : `${shop.name} was suspended`,
      body:
        status === 'active'
          ? 'Your listing was approved and is now visible on Weedtip.'
          : 'Your listing was suspended. Contact support if you have questions.',
      href: status === 'active' ? `/dispensary/${shop.slug}` : '/dashboard',
    });
  }
  revalidatePath('/admin/dispensaries');
  revalidatePath('/admin');
}

// ─── Dispensary data editing (audit #21: was raw-SQL-only) ───────────────────

const adminDispensarySchema = z.object({
  name: z.string().min(2).max(120),
  legal_name: z.string().max(200).nullable(),
  description: z.string().max(5000).nullable(),
  address: z.string().min(3).max(200).nullable(),
  city: z.string().min(1).max(100).nullable(),
  state: z.string().length(2, 'Use the 2-letter state code'),
  zip: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code')
    .nullable(),
  county: z.string().max(100).nullable(),
  phone: z.string().max(30).nullable(),
  email: z.string().email().nullable(),
  website: z.string().url().nullable(),
  license_number: z.string().max(80).nullable(),
  is_medical: z.boolean(),
  is_recreational: z.boolean(),
  is_delivery: z.boolean(),
  is_pickup: z.boolean(),
  location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullable(),
});

export async function adminUpdateDispensary(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, 'id');
  if (!id) return formError('Missing listing id.');
  const lat = numOpt(fd, 'latitude');
  const lng = numOpt(fd, 'longitude');
  const parsed = adminDispensarySchema.safeParse({
    name: str(fd, 'name') ?? '',
    legal_name: str(fd, 'legal_name') ?? null,
    description: str(fd, 'description') ?? null,
    address: str(fd, 'address') ?? null,
    city: str(fd, 'city') ?? null,
    state: (str(fd, 'state') ?? '').toUpperCase(),
    zip: str(fd, 'zip') ?? null,
    county: str(fd, 'county') ?? null,
    phone: str(fd, 'phone') ?? null,
    email: str(fd, 'email') ?? null,
    website: str(fd, 'website') ?? null,
    license_number: str(fd, 'license_number') ?? null,
    is_medical: bool(fd, 'is_medical'),
    is_recreational: bool(fd, 'is_recreational'),
    is_delivery: bool(fd, 'is_delivery'),
    is_pickup: bool(fd, 'is_pickup'),
    location: lat !== undefined && lng !== undefined ? { lat, lng } : null,
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const { location, ...rest } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from('dispensaries')
    .update({
      ...rest,
      // Only write the geography when real coordinates were supplied.
      ...(location
        ? { location: `SRID=4326;POINT(${location.lng} ${location.lat})` }
        : {}),
    })
    .eq('id', id);
  if (error) return formError(error.message);

  revalidatePath('/admin/dispensaries');
  revalidatePath(`/admin/dispensaries/${id}`);
  return { status: 'success', message: 'Listing saved.' };
}

export async function adminDeleteDispensary(id: string): Promise<{ error?: string } | void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_delete_dispensary', { p_id: id });
  if (error) return { error: error.message };
  revalidatePath('/admin/dispensaries');
  redirect('/admin/dispensaries');
}

export async function adminMergeDispensaries(
  keepId: string,
  dupId: string,
): Promise<{ error?: string } | void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_merge_dispensaries', {
    p_keep: keepId,
    p_dup: dupId,
  });
  if (error) return { error: error.message };
  revalidatePath('/admin/dispensaries');
  revalidatePath(`/admin/dispensaries/${keepId}`);
}

// ─── Brand markets (per-state featured auction) ──────────────────────────────

const brandAdRegionSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be a lowercase, hyphen-separated slug'),
  state: z.string().length(2, 'Use the 2-letter state code'),
  featured_rate_cents: z.number().int().min(0).max(100_000_00),
  slots: z.number().int().min(1).max(20),
  is_active: z.boolean(),
});

export async function upsertBrandAdRegion(_prev: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, 'name') ?? '';
  const rate = numOpt(fd, 'rate_dollars');
  const parsed = brandAdRegionSchema.safeParse({
    name,
    slug: str(fd, 'slug') ?? slugify(name),
    state: (str(fd, 'state') ?? '').toUpperCase(),
    featured_rate_cents: rate !== undefined ? Math.round(rate * 100) : 0,
    slots: numOpt(fd, 'slots') ?? 1,
    is_active: bool(fd, 'is_active'),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const id = str(fd, 'id');
  const { error } = id
    ? await supabase.from('brand_ad_regions').update(parsed.data).eq('id', id)
    : await supabase.from('brand_ad_regions').insert(parsed.data);
  if (error) {
    return error.code === '23505'
      ? formError('A market for that state or slug already exists.')
      : formError(error.message);
  }
  revalidatePath('/admin/brand-regions');
  redirect('/admin/brand-regions');
}

export async function deleteBrandAdRegion(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('brand_ad_regions').delete().eq('id', id);
  revalidatePath('/admin/brand-regions');
}

export async function setPosAddon(id: string, enabled: boolean): Promise<void> {
  const supabase = await createClient();
  // RLS + the enforce_dispensary_admin_fields trigger permit pos_addon only for admins.
  await supabase.from('dispensaries').update({ pos_addon: enabled }).eq('id', id);
  revalidatePath('/admin/dispensaries');
}

export async function setDispensaryFeatured(id: string, featured: boolean): Promise<void> {
  const supabase = await createClient();
  // featured_manual is the admin's intent; sync_featured_flags recomputes the
  // effective `featured` flag (manual OR a live featured placement).
  await supabase.from('dispensaries').update({ featured_manual: featured }).eq('id', id);
  await supabase.rpc('sync_featured_flags', { p_dispensary_id: id });
  revalidatePath('/admin/dispensaries');
  revalidatePath('/');
}

// ─── Monetization: paid placements ───────────────────────────────────────────

const placementSchema = z.object({
  dispensary_id: z.string().uuid(),
  type: z.enum(['featured', 'hero', 'promoted_deal', 'promoted_product']),
  target_id: z.string().uuid().nullable(),
  scope_state: z.string().length(2).nullable(),
  scope_city: z.string().max(100).nullable(),
  priority: z.number().int().min(0).max(1000),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime().nullable(),
  price_cents: z.number().int().min(0),
  notes: z.string().max(500).nullable(),
});

export async function createPlacement(_prev: FormState, fd: FormData): Promise<FormState> {
  const type = str(fd, 'type') ?? '';
  const needsTarget = type === 'promoted_deal' || type === 'promoted_product';
  const parsed = placementSchema.safeParse({
    dispensary_id: str(fd, 'dispensary_id') ?? '',
    type,
    target_id: needsTarget ? (str(fd, 'target_id') ?? null) : null,
    scope_state: str(fd, 'scope_state')?.toUpperCase() ?? null,
    scope_city: str(fd, 'scope_city') ?? null,
    priority: numOpt(fd, 'priority') ?? 0,
    starts_at: toIso(str(fd, 'starts_at')) ?? new Date().toISOString(),
    ends_at: toIso(str(fd, 'ends_at')) ?? null,
    price_cents: Math.round((numOpt(fd, 'price') ?? 0) * 100),
    notes: str(fd, 'notes') ?? null,
  });
  if (!parsed.success) return fromZodError(parsed.error);
  if (needsTarget && !parsed.data.target_id) {
    return formError('Pick a target deal/product for a promoted placement.');
  }

  const supabase = await createClient();
  const { error } = await supabase.from('placements').insert(parsed.data);
  if (error) return formError(error.message);

  if (parsed.data.type === 'featured') {
    await supabase.rpc('sync_featured_flags', { p_dispensary_id: parsed.data.dispensary_id });
  }
  revalidatePath('/admin/promotions');
  revalidatePath('/');
  redirect('/admin/promotions');
}

export async function setPlacementActive(
  id: string,
  isActive: boolean,
  dispensaryId: string | null,
): Promise<void> {
  const supabase = await createClient();
  // A pending sales-led request has no dates yet — resuming it here would
  // create a perpetual (no-end-date) live placement that was never billed.
  // Activation must go through /admin/billing (activatePlacementRequest),
  // which stamps starts_at/ends_at from the requested duration.
  if (isActive) {
    const { data: p } = await supabase
      .from('placements')
      .select('status')
      .eq('id', id)
      .maybeSingle();
    if (p?.status === 'pending') {
      throw new Error('This is a pending billing request — activate it from Billing so it gets a term.');
    }
  }
  await supabase.from('placements').update({ is_active: isActive }).eq('id', id);
  // Only dispensary placements drive the featured flag; brand promos don't.
  if (dispensaryId) await supabase.rpc('sync_featured_flags', { p_dispensary_id: dispensaryId });
  revalidatePath('/admin/promotions');
  revalidatePath('/');
}

export async function deletePlacement(id: string, dispensaryId: string | null): Promise<void> {
  const supabase = await createClient();
  await supabase.from('placements').delete().eq('id', id);
  if (dispensaryId) await supabase.rpc('sync_featured_flags', { p_dispensary_id: dispensaryId });
  revalidatePath('/admin/promotions');
  revalidatePath('/');
}

// ─── Monetization: subscriptions ─────────────────────────────────────────────

export async function setDispensaryPlan(_prev: FormState, fd: FormData): Promise<FormState> {
  const dispensary_id = str(fd, 'dispensary_id') ?? '';
  const plan_id = str(fd, 'plan_id') ?? null;
  const status = str(fd, 'status') ?? 'active';
  if (!dispensary_id) return formError('Missing dispensary.');

  const supabase = await createClient();
  const { error } = await supabase.from('dispensary_subscriptions').upsert(
    { dispensary_id, plan_id, status, updated_at: new Date().toISOString() },
    { onConflict: 'dispensary_id' },
  );
  if (error) return formError(error.message);
  revalidatePath('/admin/promotions');
  return { status: 'success', message: 'Subscription updated.' };
}

// ─── Ownership claims ────────────────────────────────────────────────────────

/** Email + in-app notify the claimant about the decision — best-effort. */
async function notifyClaimDecision(requestId: string, approved: boolean): Promise<void> {
  const supabase = await createClient();
  const { data: req } = await supabase
    .from('ownership_requests')
    .select('business_email, user_id, dispensary:dispensaries(name, slug)')
    .eq('id', requestId)
    .maybeSingle();
  const shop = req?.dispensary as { name: string; slug: string } | null;
  if (!shop) return;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  if (req?.business_email) {
    const m = claimDecisionEmail(shop.name, approved, siteUrl);
    await sendEmail({ to: req.business_email, subject: m.subject, html: m.html });
  }
  if (req?.user_id) {
    await notifyUser(req.user_id, {
      type: 'claim_decision',
      title: approved ? `You now manage ${shop.name}` : `Claim update — ${shop.name}`,
      body: approved
        ? 'Your ownership claim was approved. Open your dashboard to manage the listing.'
        : 'Your ownership claim was not approved. Reply to our email if you think this is a mistake.',
      href: approved ? '/dashboard' : `/dispensary/${shop.slug}`,
      data: { request_id: requestId, dispensary_slug: shop.slug },
    });
  }
}

export async function approveOwnershipRequest(id: string): Promise<void> {
  const supabase = await createClient();
  // SECURITY DEFINER RPC: verifies admin, sets dispensaries.owner_id, auto-rejects rivals.
  await supabase.rpc('approve_ownership_request', { p_request_id: id });
  await notifyClaimDecision(id, true);
  revalidatePath('/admin/claims');
  revalidatePath('/admin');
}

export async function rejectOwnershipRequest(id: string): Promise<void> {
  const supabase = await createClient();
  await notifyClaimDecision(id, false);
  await supabase.rpc('reject_ownership_request', { p_request_id: id });
  revalidatePath('/admin/claims');
}

/** Email + in-app notify the brand claimant the decision (parity with listings). */
async function notifyBrandClaimDecision(claimId: string, approved: boolean): Promise<void> {
  const supabase = await createClient();
  const { data: claim } = await supabase
    .from('brand_claims')
    .select('business_email, user_id, brand:brands(name, slug)')
    .eq('id', claimId)
    .maybeSingle();
  const brand = claim?.brand as { name: string; slug: string } | null;
  if (!brand) return;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  if (claim?.business_email) {
    const m = brandClaimDecisionEmail(brand.name, approved, siteUrl);
    await sendEmail({ to: claim.business_email, subject: m.subject, html: m.html });
  }
  if (claim?.user_id) {
    await notifyUser(claim.user_id, {
      type: 'brand_claim_decision',
      title: approved ? `You now manage ${brand.name}` : `Brand claim update — ${brand.name}`,
      body: approved
        ? 'Your brand claim was approved. Set up your brand in Studio.'
        : 'Your brand claim was not approved.',
      href: approved ? '/studio' : `/brand/${brand.slug}`,
      data: { claim_id: claimId, brand_slug: brand.slug },
    });
  }
}

export async function approveBrandClaim(id: string): Promise<void> {
  const supabase = await createClient();
  // SECURITY DEFINER RPC: verifies admin, sets brands.owner_id, auto-rejects rivals.
  await supabase.rpc('approve_brand_claim', { p_claim_id: id });
  await notifyBrandClaimDecision(id, true);
  revalidatePath('/admin/claims');
  revalidatePath('/brands');
}

export async function rejectBrandClaim(id: string): Promise<void> {
  const supabase = await createClient();
  await notifyBrandClaimDecision(id, false);
  await supabase.rpc('reject_brand_claim', { p_claim_id: id });
  revalidatePath('/admin/claims');
}

// ─── Self-serve brand review ───────────────────────────────────────────────────

/** Approve a self-created (pending) brand → active, and email the owner. */
export async function approveBrand(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: brand } = await supabase
    .from('brands')
    .update({ status: 'active' })
    .eq('id', id)
    .eq('status', 'pending')
    .select('name, owner_id')
    .maybeSingle();

  // Notify the owner their brand is live (owner email lives in auth, not profiles).
  if (brand?.owner_id) {
    try {
      const svc = createServiceClient();
      const { data } = await svc.auth.admin.getUserById(brand.owner_id);
      const email = data.user?.email;
      if (email) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
        const m = brandClaimDecisionEmail(brand.name, true, siteUrl);
        await sendEmail({ to: email, subject: m.subject, html: m.html });
      }
    } catch (e) {
      console.warn('[admin] brand-approve owner email failed:', e);
    }
    await notifyUser(brand.owner_id, {
      type: 'brand_approved',
      title: `${brand.name} is live`,
      body: 'Your brand was approved and is now public. Set it up in Brand Studio.',
      href: '/studio',
    });
  }

  revalidatePath('/admin/brands');
  revalidatePath('/brands');
  revalidatePath('/studio');
}

/** Reject a self-created (pending) brand. */
export async function rejectBrand(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: brand } = await supabase
    .from('brands')
    .update({ status: 'rejected' })
    .eq('id', id)
    .eq('status', 'pending')
    .select('name, owner_id')
    .maybeSingle();
  if (brand?.owner_id) {
    await notifyUser(brand.owner_id, {
      type: 'brand_rejected',
      title: `Update on ${brand.name}`,
      body: 'Your brand submission was not approved. Reply to our team if you have questions.',
      href: '/for-brands',
    });
  }
  revalidatePath('/admin/brands');
}

// ─── Categories ──────────────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().min(1).max(60),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be a lowercase, hyphen-separated slug'),
  icon: z.string().max(40).nullable(),
  sort_order: z.number().int().min(0).max(9999),
});

export async function upsertCategory(_prev: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, 'name') ?? '';
  const parsed = categorySchema.safeParse({
    name,
    slug: str(fd, 'slug') ?? slugify(name),
    icon: str(fd, 'icon') ?? null,
    sort_order: numOpt(fd, 'sort_order') ?? 0,
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const id = str(fd, 'id');
  const { error } = id
    ? await supabase.from('categories').update(parsed.data).eq('id', id)
    : await supabase.from('categories').insert(parsed.data);

  if (error) {
    return error.code === '23505'
      ? formError('That name or slug is already in use.')
      : formError(error.message);
  }
  revalidatePath('/admin/categories');
  redirect('/admin/categories');
}

export async function deleteCategory(id: string): Promise<{ error?: string } | void> {
  const supabase = await createClient();
  // FK on products.category_id is ON DELETE RESTRICT — deletion fails if in use.
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) {
    return {
      error:
        error.code === '23503'
          ? 'Cannot delete — products still use this category. Reassign them first.'
          : error.message,
    };
  }
  revalidatePath('/admin/categories');
}

// ─── Operating regions ───────────────────────────────────────────────────────

const regionSchema = z.object({
  state: z.string().length(2),
  is_medical_legal: z.boolean(),
  is_recreational_legal: z.boolean(),
  min_age: z.number().int().min(18).max(25),
  // Entered as a percentage in the form (e.g. 13 for NY); stored as a fraction.
  tax_rate: z.number().min(0).max(100),
  notes: z.string().max(500).nullable(),
});

export async function upsertRegion(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = regionSchema.safeParse({
    state: (str(fd, 'state') ?? '').toUpperCase(),
    is_medical_legal: bool(fd, 'is_medical_legal'),
    is_recreational_legal: bool(fd, 'is_recreational_legal'),
    min_age: numOpt(fd, 'min_age') ?? DEFAULT_MIN_AGE,
    tax_rate: numOpt(fd, 'tax_percent') ?? 15,
    notes: str(fd, 'notes') ?? null,
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from('operating_regions')
    .upsert({ ...parsed.data, tax_rate: parsed.data.tax_rate / 100 }, { onConflict: 'state' });
  if (error) return formError(error.message);

  revalidatePath('/admin/regions');
  redirect('/admin/regions');
}

export async function deleteRegion(state: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('operating_regions').delete().eq('state', state);
  revalidatePath('/admin/regions');
}

// ─── Review moderation (admin can remove any review; RLS permits is_admin) ────

export async function adminDeleteReview(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('reviews').delete().eq('id', id);
  revalidatePath('/admin/reviews');
}

export async function adminDeleteProductReview(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('product_reviews').delete().eq('id', id);
  revalidatePath('/admin/reviews');
}

// ─── Strains ─────────────────────────────────────────────────────────────────

function splitList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

const strainSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be a lowercase, hyphen-separated slug'),
  type: z.enum(STRAIN_TYPES),
  description: z.string().max(5000).nullable(),
  effects: z.array(z.string().max(40)).max(20),
  flavors: z.array(z.string().max(40)).max(20),
  terpenes: z.array(z.string().max(40)).max(20),
  negative_effects: z.array(z.string().max(40)).max(20),
  medical_uses: z.array(z.string().max(60)).max(20),
  parents: z.array(z.string().max(60)).max(10),
  thc_low: z.number().min(0).max(100).nullable(),
  thc_high: z.number().min(0).max(100).nullable(),
  cbd_low: z.number().min(0).max(100).nullable(),
  cbd_high: z.number().min(0).max(100).nullable(),
  grow_difficulty: z.string().max(40).nullable(),
  flowering_days_min: z.number().int().min(0).max(365).nullable(),
  flowering_days_max: z.number().int().min(0).max(365).nullable(),
  yield_note: z.string().max(120).nullable(),
  grow_notes: z.string().max(2000).nullable(),
});

export async function upsertStrain(_prev: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, 'name') ?? '';
  const parsed = strainSchema.safeParse({
    name,
    slug: str(fd, 'slug') ?? slugify(name),
    type: str(fd, 'type') ?? 'hybrid',
    description: str(fd, 'description') ?? null,
    effects: splitList(str(fd, 'effects')),
    flavors: splitList(str(fd, 'flavors')),
    terpenes: splitList(str(fd, 'terpenes')),
    negative_effects: splitList(str(fd, 'negative_effects')),
    medical_uses: splitList(str(fd, 'medical_uses')),
    parents: splitList(str(fd, 'parents')),
    thc_low: numOpt(fd, 'thc_low') ?? null,
    thc_high: numOpt(fd, 'thc_high') ?? null,
    cbd_low: numOpt(fd, 'cbd_low') ?? null,
    cbd_high: numOpt(fd, 'cbd_high') ?? null,
    grow_difficulty: str(fd, 'grow_difficulty') ?? null,
    flowering_days_min: numOpt(fd, 'flowering_days_min') ?? null,
    flowering_days_max: numOpt(fd, 'flowering_days_max') ?? null,
    yield_note: str(fd, 'yield_note') ?? null,
    grow_notes: str(fd, 'grow_notes') ?? null,
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const id = str(fd, 'id');
  const { error } = id
    ? await supabase.from('strains').update(parsed.data).eq('id', id)
    : await supabase.from('strains').insert(parsed.data);

  if (error) {
    return error.code === '23505'
      ? formError('A strain with that name or slug already exists.')
      : formError(error.message);
  }
  revalidatePath('/admin/strains');
  revalidatePath('/strains');
  redirect('/admin/strains');
}

export async function deleteStrain(id: string): Promise<{ error?: string } | void> {
  const supabase = await createClient();
  const { error } = await supabase.from('strains').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin/strains');
}

// ─── Brands ──────────────────────────────────────────────────────────────────

const brandSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be a lowercase, hyphen-separated slug'),
  description: z.string().max(2000).nullable(),
  logo_url: z.string().url().nullable(),
});

export async function upsertBrand(_prev: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, 'name') ?? '';
  const parsed = brandSchema.safeParse({
    name,
    slug: str(fd, 'slug') ?? slugify(name),
    description: str(fd, 'description') ?? null,
    logo_url: str(fd, 'logo_url') ?? null,
  });
  if (!parsed.success) return fromZodError(parsed.error);

  // website isn't part of the shared brandSchema; merge it in (nullable column).
  const websiteRaw = str(fd, 'website');
  const payload = { ...parsed.data, website: websiteRaw ?? null };

  const supabase = await createClient();
  const id = str(fd, 'id');
  const { error } = id
    ? await supabase.from('brands').update(payload).eq('id', id)
    : await supabase.from('brands').insert(payload);

  if (error) {
    return error.code === '23505'
      ? formError('A brand with that name or slug already exists.')
      : formError(error.message);
  }
  revalidatePath('/admin/brands');
  revalidatePath('/brands');
  redirect('/admin/brands');
}

export async function deleteBrand(id: string): Promise<{ error?: string } | void> {
  const supabase = await createClient();
  const { error } = await supabase.from('brands').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin/brands');
}
