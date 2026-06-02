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
import {
  bool,
  formError,
  formSuccess,
  fromZodError,
  numOpt,
  str,
  type FormState,
} from '@/lib/forms';

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
    announcement: str(fd, 'announcement') ?? null,
    amenities: fd.getAll('amenities').filter((v): v is string => typeof v === 'string'),
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
    strain_id: str(fd, 'strain_id') ?? null,
    brand_id: str(fd, 'brand_id') ?? null,
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

// ─── Bulk menu import (CSV) ──────────────────────────────────────────────────

/** Minimal CSV line parser: handles quoted fields and escaped quotes. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const IMPORT_STRAINS = new Set(['indica', 'sativa', 'hybrid', 'cbd']);

/**
 * Bulk-import products from pasted CSV. Required columns: name, category, price
 * (dollars). Optional: brand, strain_type, thc, cbd, unit, description, in_stock.
 * Upserts on (dispensary_id, slug) so re-imports update in place.
 */
export async function importProducts(_prev: FormState, fd: FormData): Promise<FormState> {
  const auth = await authedClient();
  if (!auth) return formError('You must be signed in.');
  const { supabase, userId } = auth;
  const dispensaryId = await ownerDispensaryId(supabase, userId);
  if (!dispensaryId) return formError('Create your dispensary listing first.');

  const lines = (str(fd, 'csv') ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return formError('Paste a CSV with a header row and at least one product row.');
  }

  const header = parseCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const ci = {
    name: idx('name'),
    category: idx('category'),
    price: idx('price'),
    brand: idx('brand'),
    strain: idx('strain_type'),
    thc: idx('thc'),
    cbd: idx('cbd'),
    unit: idx('unit'),
    description: idx('description'),
    inStock: idx('in_stock'),
  };
  if (ci.name < 0 || ci.category < 0 || ci.price < 0) {
    return formError('CSV must include at least "name", "category", and "price" columns.');
  }

  const { data: categories } = await supabase.from('categories').select('id,slug,name');
  const catMap = new Map<string, string>();
  for (const c of categories ?? []) {
    catMap.set(c.slug.toLowerCase(), c.id);
    catMap.set(c.name.toLowerCase(), c.id);
  }

  const rows: Database['public']['Tables']['products']['Insert'][] = [];
  const errors: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]!);
    const get = (col: number) => (col >= 0 ? (cells[col] ?? '').trim() : '');

    const name = get(ci.name);
    if (!name) {
      errors.push(`Row ${i}: missing name`);
      continue;
    }
    const categoryId = catMap.get(get(ci.category).toLowerCase());
    if (!categoryId) {
      errors.push(`Row ${i} (${name}): unknown category "${get(ci.category)}"`);
      continue;
    }
    const price = Number(get(ci.price));
    if (!Number.isFinite(price) || price < 0) {
      errors.push(`Row ${i} (${name}): invalid price`);
      continue;
    }
    const strain = get(ci.strain).toLowerCase();
    const thc = Number(get(ci.thc));
    const cbd = Number(get(ci.cbd));
    const inStock = get(ci.inStock).toLowerCase();

    rows.push({
      dispensary_id: dispensaryId,
      category_id: categoryId,
      name,
      slug: slugify(name),
      brand: get(ci.brand) || null,
      description: get(ci.description) || null,
      strain_type: IMPORT_STRAINS.has(strain)
        ? (strain as Database['public']['Enums']['strain_type'])
        : null,
      thc_percentage: Number.isFinite(thc) && thc >= 0 && thc <= 100 ? thc : null,
      cbd_percentage: Number.isFinite(cbd) && cbd >= 0 && cbd <= 100 ? cbd : null,
      price_cents: Math.round(price * 100),
      unit: get(ci.unit) || null,
      in_stock: inStock ? ['true', 'yes', '1', 'y'].includes(inStock) : true,
    });
  }

  if (rows.length === 0) {
    return formError(`No valid rows. ${errors.slice(0, 5).join('; ')}`);
  }

  const { error } = await supabase
    .from('products')
    .upsert(rows, { onConflict: 'dispensary_id,slug' });
  if (error) return formError(error.message);

  revalidatePath('/dashboard/products');
  const skipped = errors.length
    ? ` Skipped ${errors.length}: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '…' : ''}`
    : '';
  return formSuccess(`Imported ${rows.length} product${rows.length === 1 ? '' : 's'}.${skipped}`);
}
