'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import { formError, formSuccess, type FormState } from '@/lib/forms';
import { stripe } from '@/lib/stripe';
import { slugify } from '@/lib/utils';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Admin console actions for the geographic ad system (Phase 4). Region/zone
 * writes go through admin RLS policies; boundary/comp/cancel go through
 * SECURITY DEFINER RPCs that re-check is_admin() server-side — the UI gate in
 * /admin/layout is defense-in-depth only.
 */

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
};
const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const regionSchema = z.object({
  market_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase, hyphen-separated slug'),
  tier: z.enum(['A_PLUS', 'A', 'B_PLUS', 'B']),
  exclusive_price_min: z.number().int().min(0).nullable(),
  exclusive_price_max: z.number().int().min(0).nullable(),
  is_active: z.boolean(),
  sort_order: z.number().int(),
});

export async function upsertAdRegion(_prev: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, 'name') ?? '';
  const excMin = num(fd, 'exclusive_min_dollars');
  const excMax = num(fd, 'exclusive_max_dollars');
  const parsed = regionSchema.safeParse({
    market_id: str(fd, 'market_id'),
    name,
    slug: str(fd, 'slug') ?? slugify(name),
    tier: str(fd, 'tier'),
    exclusive_price_min: excMin !== undefined ? Math.round(excMin * 100) : null,
    exclusive_price_max: excMax !== undefined ? Math.round(excMax * 100) : null,
    is_active: fd.get('is_active') === 'on',
    sort_order: num(fd, 'sort_order') ?? 0,
  });
  if (!parsed.success) return formError(parsed.error.errors[0]?.message ?? 'Check the fields.');

  const supabase = await createClient();
  const id = str(fd, 'id');
  const { data, error } = id
    ? await supabase.from('ad_regions').update(parsed.data).eq('id', id).select('id').single()
    : await supabase.from('ad_regions').insert(parsed.data).select('id').single();
  if (error) {
    return error.code === '23505'
      ? formError('A region with that slug already exists.')
      : formError(error.message);
  }

  // New regions need their fixed slot inventory (1 exclusive + 3 featured + 10 premium).
  if (!id && data) {
    const slots = [
      { region_id: data.id, slot_type: 'exclusive' as const, position: 1 },
      ...Array.from({ length: 3 }, (_, i) => ({
        region_id: data.id,
        slot_type: 'featured' as const,
        position: i + 1,
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        region_id: data.id,
        slot_type: 'premium' as const,
        position: i + 1,
      })),
    ];
    await supabase.from('ad_slots').insert(slots);
  }

  revalidatePath('/admin/ad-regions');
  if (!id && data) redirect(`/admin/ad-regions/${data.id}`);
  return formSuccess('Region saved.');
}

export async function upsertAdZone(_prev: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, 'name') ?? '';
  const lng = num(fd, 'lng');
  const lat = num(fd, 'lat');
  const regionId = str(fd, 'region_id');
  if (!regionId || !name || lng === undefined || lat === undefined) {
    return formError('Name, longitude, and latitude are required.');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_upsert_ad_zone', {
    p_region_id: regionId,
    p_slug: str(fd, 'slug') ?? slugify(name),
    p_name: name,
    p_lng: lng,
    p_lat: lat,
    p_id: str(fd, 'id') ?? null,
  });
  if (error) {
    return error.code === '23505'
      ? formError('A zone with that slug already exists.')
      : formError(error.message);
  }
  revalidatePath(`/admin/ad-regions/${regionId}`);
  return formSuccess('Zone saved (new zones get a 2.5 km starter boundary).');
}

export async function deleteAdZone(zoneId: string, regionId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('ad_zones').delete().eq('id', zoneId);
  revalidatePath(`/admin/ad-regions/${regionId}`);
}

export async function setAdBoundary(_prev: FormState, fd: FormData): Promise<FormState> {
  const kind = str(fd, 'kind');
  const id = str(fd, 'target_id');
  if ((kind !== 'region' && kind !== 'zone') || !id) return formError('Invalid request.');

  const geojson = typeof fd.get('geojson') === 'string' ? String(fd.get('geojson')).trim() : '';
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_ad_boundary', {
    p_kind: kind,
    p_id: id,
    p_geojson: geojson,
  });
  if (error) return formError(error.message);
  revalidatePath('/admin/ad-regions');
  return formSuccess(geojson ? 'Boundary updated (validated with ST_IsValid).' : 'Boundary cleared.');
}

export async function compSlot(_prev: FormState, fd: FormData): Promise<FormState> {
  const slotId = str(fd, 'slot_id');
  const shopSlug = str(fd, 'dispensary_slug');
  const priceDollars = num(fd, 'price_dollars') ?? 0;
  if (!slotId || !shopSlug) return formError('Pick a slot and enter the dispensary slug.');

  const supabase = await createClient();
  const { data: shop } = await supabase
    .from('dispensaries')
    .select('id,name')
    .eq('slug', shopSlug)
    .maybeSingle();
  if (!shop) return formError(`No dispensary with slug "${shopSlug}".`);

  const { error } = await supabase.rpc('admin_comp_slot', {
    p_slot_id: slotId,
    p_dispensary_id: shop.id,
    p_price: Math.round(priceDollars * 100),
  });
  if (error) {
    return error.message.includes('SLOT_TAKEN')
      ? formError('That slot already has a live subscription.')
      : formError(error.message);
  }
  revalidatePath('/admin/ad-regions');
  return formSuccess(`${shop.name} placed (no Stripe billing — a negotiated/comp deal).`);
}

export async function cancelAdSubscription(subscriptionId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc('admin_cancel_ad_subscription', { p_subscription_id: subscriptionId });
  revalidatePath('/admin/ad-regions');
}

const TIER_LABEL: Record<string, string> = { A_PLUS: 'A+', A: 'A', B_PLUS: 'B+', B: 'B' };
const SLOT_LABEL: Record<string, string> = {
  featured: 'Featured',
  premium: 'Premium Listing',
  standard: 'Standard Listing',
};

/**
 * One-click version of scripts/seed-stripe-ad-products.mjs: creates a Stripe
 * Product + monthly Price (at LAUNCH price) for every sellable (slot_type,
 * tier) and writes the price id back to ad_products. Idempotent — rows that
 * already have a stripe_price_id are skipped, as is `exclusive` (negotiated,
 * never self-serve). Runs on the server with the deployment's env vars, so no
 * local setup is needed.
 */
export async function syncStripeAdPrices(_prev: FormState, _fd: FormData): Promise<FormState> {
  await requireAdmin();
  if (!stripe) {
    return formError('Stripe is not configured — set STRIPE_SECRET_KEY in Vercel and redeploy.');
  }

  const supabase = createServiceClient();
  const { data: products, error } = await supabase
    .from('ad_products')
    .select('id, slot_type, tier, launch_price, stripe_price_id')
    .order('slot_type')
    .order('tier');
  if (error) return formError(`Could not read ad_products: ${error.message}`);

  let created = 0;
  let skipped = 0;
  for (const p of products ?? []) {
    if (p.stripe_price_id || p.slot_type === 'exclusive') {
      skipped += 1;
      continue;
    }
    const name = `${SLOT_LABEL[p.slot_type] ?? p.slot_type} — Tier ${TIER_LABEL[p.tier] ?? p.tier}`;
    try {
      const product = await stripe.products.create({
        name,
        metadata: { kind: 'ad_slot', slot_type: p.slot_type, tier: p.tier },
      });
      const price = await stripe.prices.create({
        product: product.id,
        currency: 'usd',
        unit_amount: p.launch_price,
        recurring: { interval: 'month' },
        metadata: { kind: 'ad_slot', slot_type: p.slot_type, tier: p.tier, basis: 'launch_price' },
      });
      const { error: upErr } = await supabase
        .from('ad_products')
        .update({ stripe_price_id: price.id })
        .eq('id', p.id);
      if (upErr) {
        return formError(
          `Created ${created}, then failed to save ${name}: ${upErr.message}. Re-run to continue — existing prices are skipped.`,
        );
      }
      created += 1;
    } catch (e) {
      return formError(
        `Created ${created}, then Stripe rejected ${name}: ${e instanceof Error ? e.message : 'unknown error'}. Re-run to continue.`,
      );
    }
  }

  revalidatePath('/admin/ad-regions');
  return formSuccess(
    created > 0
      ? `Created ${created} Stripe price(s); ${skipped} already set or not self-serve. Slots are now buyable on /advertise.`
      : `Nothing to do — all ${skipped} products already have prices or are negotiated-only.`,
  );
}
