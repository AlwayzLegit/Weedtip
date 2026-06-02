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
  await supabase.from('dispensaries').update({ featured }).eq('id', id);
  revalidatePath('/admin/dispensaries');
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

export async function deleteCategory(id: string): Promise<void> {
  const supabase = await createClient();
  // FK on products.category_id is ON DELETE RESTRICT — deletion fails if in use.
  await supabase.from('categories').delete().eq('id', id);
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

export async function deleteStrain(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('strains').delete().eq('id', id);
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

  const supabase = await createClient();
  const id = str(fd, 'id');
  const { error } = id
    ? await supabase.from('brands').update(parsed.data).eq('id', id)
    : await supabase.from('brands').insert(parsed.data);

  if (error) {
    return error.code === '23505'
      ? formError('A brand with that name or slug already exists.')
      : formError(error.message);
  }
  revalidatePath('/admin/brands');
  revalidatePath('/brands');
  redirect('/admin/brands');
}

export async function deleteBrand(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('brands').delete().eq('id', id);
  revalidatePath('/admin/brands');
}
