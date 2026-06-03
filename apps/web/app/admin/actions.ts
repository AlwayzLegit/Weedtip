'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  DEFAULT_MIN_AGE,
  DISPENSARY_STATUSES,
  STRAIN_TYPES,
  type DispensaryStatus,
} from '@weedtip/shared';
import { createClient } from '@/lib/supabase/server';
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
  await supabase
    .from('dispensaries')
    .update({ status: status as DispensaryStatus })
    .eq('id', id);
  revalidatePath('/admin/dispensaries');
  revalidatePath('/admin');
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
  dispensaryId: string,
): Promise<void> {
  const supabase = await createClient();
  await supabase.from('placements').update({ is_active: isActive }).eq('id', id);
  await supabase.rpc('sync_featured_flags', { p_dispensary_id: dispensaryId });
  revalidatePath('/admin/promotions');
  revalidatePath('/');
}

export async function deletePlacement(id: string, dispensaryId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('placements').delete().eq('id', id);
  await supabase.rpc('sync_featured_flags', { p_dispensary_id: dispensaryId });
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

export async function approveOwnershipRequest(id: string): Promise<void> {
  const supabase = await createClient();
  // SECURITY DEFINER RPC: verifies admin, sets dispensaries.owner_id, auto-rejects rivals.
  await supabase.rpc('approve_ownership_request', { p_request_id: id });
  revalidatePath('/admin/claims');
  revalidatePath('/admin');
}

export async function rejectOwnershipRequest(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc('reject_ownership_request', { p_request_id: id });
  revalidatePath('/admin/claims');
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
  notes: z.string().max(500).nullable(),
});

export async function upsertRegion(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = regionSchema.safeParse({
    state: (str(fd, 'state') ?? '').toUpperCase(),
    is_medical_legal: bool(fd, 'is_medical_legal'),
    is_recreational_legal: bool(fd, 'is_recreational_legal'),
    min_age: numOpt(fd, 'min_age') ?? DEFAULT_MIN_AGE,
    notes: str(fd, 'notes') ?? null,
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from('operating_regions')
    .upsert(parsed.data, { onConflict: 'state' });
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
  thc_low: z.number().min(0).max(100).nullable(),
  thc_high: z.number().min(0).max(100).nullable(),
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
    thc_low: numOpt(fd, 'thc_low') ?? null,
    thc_high: numOpt(fd, 'thc_high') ?? null,
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
