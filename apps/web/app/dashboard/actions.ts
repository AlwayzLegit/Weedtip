'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  ORDER_STATUSES,
  dealWriteSchema,
  dispensaryWriteSchema,
  operatingHoursSchema,
  productWriteSchema,
  type OrderStatus,
} from '@weedtip/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@weedtip/supabase/types';
import { createClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';
import { bool, formError, fromZodError, numOpt, str, type FormState } from '@/lib/forms';

type Client = SupabaseClient<Database>;

// ─── Shared helpers ──────────────────────────────────────────────────────────

async function authedClient(): Promise<{ supabase: Client; userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, userId: user.id };
}

/** The acting owner's primary dispensary id, or null. */
async function ownerDispensaryId(supabase: Client, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('dispensaries')
    .select('id')
    .eq('owner_id', userId)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/** "SRID=4326;POINT(lng lat)" — EWKT accepted by the geography column. */
function pointEwkt(lng: number, lat: number): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

function parseHours(fd: FormData) {
  const hours: Record<string, { open: string; close: string } | null> = {};
  for (const day of DAYS) {
    const open = str(fd, `hours_${day}_open`);
    const close = str(fd, `hours_${day}_close`);
    hours[day] = open && close ? { open, close } : null;
  }
  // Validate shape; if invalid, treat as no hours.
  const parsed = operatingHoursSchema.safeParse(hours);
  return parsed.success ? parsed.data : null;
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

// ─── Dispensary (listing) ────────────────────────────────────────────────────

export async function upsertDispensary(_prev: FormState, fd: FormData): Promise<FormState> {
  const auth = await authedClient();
  if (!auth) return formError('You must be signed in.');
  const { supabase, userId } = auth;

  const name = str(fd, 'name') ?? '';
  const input = {
    name,
    slug: str(fd, 'slug') ?? slugify(name),
    description: str(fd, 'description') ?? null,
    address: str(fd, 'address') ?? '',
    city: str(fd, 'city') ?? '',
    state: (str(fd, 'state') ?? '').toUpperCase(),
    zip: str(fd, 'zip') ?? '',
    phone: str(fd, 'phone') ?? null,
    email: str(fd, 'email') ?? null,
    website: str(fd, 'website') ?? null,
    logo_url: str(fd, 'logo_url') ?? null,
    cover_image_url: str(fd, 'cover_image_url') ?? null,
    license_number: str(fd, 'license_number') ?? null,
    is_medical: bool(fd, 'is_medical'),
    is_recreational: bool(fd, 'is_recreational'),
    is_delivery: bool(fd, 'is_delivery'),
    is_pickup: bool(fd, 'is_pickup'),
    hours: parseHours(fd),
    location: { lat: numOpt(fd, 'latitude') ?? NaN, lng: numOpt(fd, 'longitude') ?? NaN },
  };

  const parsed = dispensaryWriteSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const { location, ...rest } = parsed.data;
  const payload = {
    ...rest,
    hours: rest.hours ?? null,
    location: pointEwkt(location.lng, location.lat),
  };

  const existingId = await ownerDispensaryId(supabase, userId);
  const { error } = existingId
    ? await supabase.from('dispensaries').update(payload).eq('id', existingId)
    : await supabase.from('dispensaries').insert({ ...payload, owner_id: userId });

  if (error) {
    return isUniqueViolation(error)
      ? formError('That URL slug is already taken — choose another.')
      : formError(error.message);
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/listing');
  revalidatePath(`/dispensary/${payload.slug}`);
  redirect('/dashboard');
}

// ─── Products ──────────────────────────────────────────────────────────────

export async function upsertProduct(_prev: FormState, fd: FormData): Promise<FormState> {
  const auth = await authedClient();
  if (!auth) return formError('You must be signed in.');
  const { supabase, userId } = auth;

  const dispensaryId = await ownerDispensaryId(supabase, userId);
  if (!dispensaryId) return formError('Create your dispensary listing first.');

  const id = str(fd, 'id');
  const name = str(fd, 'name') ?? '';
  const priceDollars = numOpt(fd, 'price');
  const imageUrls = (str(fd, 'image_urls') ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const input = {
    category_id: str(fd, 'category_id') ?? '',
    name,
    slug: str(fd, 'slug') ?? slugify(name),
    brand: str(fd, 'brand') ?? null,
    description: str(fd, 'description') ?? null,
    image_urls: imageUrls,
    strain_type: str(fd, 'strain_type') ?? null,
    thc_percentage: numOpt(fd, 'thc_percentage') ?? null,
    cbd_percentage: numOpt(fd, 'cbd_percentage') ?? null,
    price_cents: priceDollars !== undefined ? Math.round(priceDollars * 100) : NaN,
    weight_grams: numOpt(fd, 'weight_grams') ?? null,
    unit: str(fd, 'unit') ?? null,
    in_stock: bool(fd, 'in_stock'),
    is_featured: bool(fd, 'is_featured'),
  };

  const parsed = productWriteSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const payload = { ...parsed.data, dispensary_id: dispensaryId };
  const { error } = id
    ? await supabase.from('products').update(payload).eq('id', id).eq('dispensary_id', dispensaryId)
    : await supabase.from('products').insert(payload);

  if (error) {
    return isUniqueViolation(error)
      ? formError('A product with that URL slug already exists.')
      : formError(error.message);
  }

  revalidatePath('/dashboard/products');
  redirect('/dashboard/products');
}

export async function deleteProduct(id: string): Promise<void> {
  const auth = await authedClient();
  if (!auth) return;
  const { supabase, userId } = auth;
  const dispensaryId = await ownerDispensaryId(supabase, userId);
  if (!dispensaryId) return;
  await supabase.from('products').delete().eq('id', id).eq('dispensary_id', dispensaryId);
  revalidatePath('/dashboard/products');
}

// ─── Deals ───────────────────────────────────────────────────────────────────

function toIso(local: string | undefined): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export async function upsertDeal(_prev: FormState, fd: FormData): Promise<FormState> {
  const auth = await authedClient();
  if (!auth) return formError('You must be signed in.');
  const { supabase, userId } = auth;

  const dispensaryId = await ownerDispensaryId(supabase, userId);
  if (!dispensaryId) return formError('Create your dispensary listing first.');

  const id = str(fd, 'id');
  const input = {
    title: str(fd, 'title') ?? '',
    description: str(fd, 'description') ?? null,
    discount_type: str(fd, 'discount_type') ?? '',
    discount_value: numOpt(fd, 'discount_value') ?? NaN,
    start_date: toIso(str(fd, 'start_date')) ?? '',
    end_date: toIso(str(fd, 'end_date')) ?? '',
    is_active: bool(fd, 'is_active'),
  };

  const parsed = dealWriteSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const payload = { ...parsed.data, dispensary_id: dispensaryId };
  const { error } = id
    ? await supabase.from('deals').update(payload).eq('id', id).eq('dispensary_id', dispensaryId)
    : await supabase.from('deals').insert(payload);

  if (error) return formError(error.message);

  revalidatePath('/dashboard/deals');
  redirect('/dashboard/deals');
}

export async function deleteDeal(id: string): Promise<void> {
  const auth = await authedClient();
  if (!auth) return;
  const { supabase, userId } = auth;
  const dispensaryId = await ownerDispensaryId(supabase, userId);
  if (!dispensaryId) return;
  await supabase.from('deals').delete().eq('id', id).eq('dispensary_id', dispensaryId);
  revalidatePath('/dashboard/deals');
}

// ─── Orders ────────────────────────────────────────────────────────────────

export async function updateOrderStatus(orderId: string, status: string): Promise<void> {
  if (!ORDER_STATUSES.includes(status as OrderStatus)) return;
  const auth = await authedClient();
  if (!auth) return;
  const { supabase, userId } = auth;
  const dispensaryId = await ownerDispensaryId(supabase, userId);
  if (!dispensaryId) return;
  await supabase
    .from('orders')
    .update({ status: status as OrderStatus })
    .eq('id', orderId)
    .eq('dispensary_id', dispensaryId);
  revalidatePath('/dashboard/orders');
}
