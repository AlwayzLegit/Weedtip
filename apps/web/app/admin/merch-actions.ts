'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Admin brand/product merchandising desk actions. Featured brands and featured
 * products are region ad-slot types (`ad_slots.slot_type` in 'brand' | 'product')
 * sold through `ad_subscriptions`, the same model as dispensary spots and the
 * hero. This desk lets the team COMP a house slot — fill a region's featured
 * inventory with a chosen brand/product for free while markets ramp up — and
 * END a live slot early (canceling the subscription frees the slot instantly).
 */

export type MerchActionResult = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath('/admin/merch');
  revalidatePath('/brands');
  revalidatePath('/products');
  revalidatePath('/'); // hero fills render on the homepage
}

const compSchema = z.object({
  entity: z.enum(['brand', 'product', 'hero']),
  /** brand slug, product id (UUID), or — for hero — a brand/dispensary slug. */
  ref: z.string().trim().min(1).max(120),
  /** ad-region slug; 'nationwide' is the default fallback region */
  region_slug: z.string().trim().min(1).max(120),
  days: z.number().int().min(1).max(365),
  /** For hero slots, whether `ref` is a dispensary or a brand slug. */
  hero_target: z.enum(['dispensary', 'brand']).optional(),
});
export type CompMerchInput = z.infer<typeof compSchema>;

/**
 * Comp a house brand/product slot: claim the next open slot of that type in the
 * region and create an ACTIVE, $0, house subscription that goes live immediately.
 */
export async function compMerchSlot(raw: CompMerchInput): Promise<MerchActionResult> {
  await requireAdmin();
  const parsed = compSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid input.' };
  }
  const input = parsed.data;
  const service = createServiceClient();

  // Resolve the region.
  const { data: region } = await service
    .from('ad_regions')
    .select('id, name')
    .eq('slug', input.region_slug)
    .maybeSingle();
  if (!region) return { ok: false, error: 'No ad region with that slug.' };

  // Resolve the target + advertiser. ad_subscriptions requires exactly one
  // advertiser (dispensary XOR brand); a product slot's advertiser is the shop
  // that carries it, a brand slot's advertiser is the brand itself.
  let brand_id: string | null = null;
  let dispensary_id: string | null = null;
  let product_id: string | null = null;

  // Hero slots can be comped for either a brand or a dispensary (by slug).
  const heroBrand = input.entity === 'hero' && input.hero_target === 'brand';
  const heroShop = input.entity === 'hero' && input.hero_target !== 'brand';

  if (input.entity === 'brand' || heroBrand) {
    const { data: brand } = await service
      .from('brands')
      .select('id')
      .eq('slug', input.ref)
      .maybeSingle();
    if (!brand) return { ok: false, error: 'No brand with that slug.' };
    brand_id = brand.id;
  } else if (heroShop) {
    const { data: shop } = await service
      .from('dispensaries')
      .select('id, status')
      .eq('slug', input.ref)
      .maybeSingle();
    if (!shop) return { ok: false, error: 'No dispensary with that slug.' };
    if (shop.status !== 'active') return { ok: false, error: 'That dispensary is not active.' };
    dispensary_id = shop.id;
  } else {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      input.ref,
    );
    if (!isUuid) return { ok: false, error: 'Product must be referenced by its id (UUID).' };
    const { data: product } = await service
      .from('products')
      .select('id, dispensary_id, dispensary:dispensaries(status)')
      .eq('id', input.ref)
      .maybeSingle();
    if (!product) return { ok: false, error: 'No product with that id.' };
    if ((product.dispensary as { status: string } | null)?.status !== 'active') {
      return { ok: false, error: 'That product’s dispensary is not active.' };
    }
    product_id = product.id;
    dispensary_id = product.dispensary_id;
  }

  // Find the next open slot of this type in the region: all slots minus those
  // already held by a live subscription.
  const { data: slots } = await service
    .from('ad_slots')
    .select('id, position')
    .eq('region_id', region.id)
    .eq('slot_type', input.entity)
    .order('position');
  if (!slots?.length) return { ok: false, error: `No ${input.entity} inventory in that region.` };

  const { data: liveSubs } = await service
    .from('ad_subscriptions')
    .select('slot_id')
    .in(
      'slot_id',
      slots.map((s) => s.id),
    )
    .in('status', ['pending', 'active', 'past_due']);
  const taken = new Set((liveSubs ?? []).map((s) => s.slot_id));
  const open = slots.find((s) => !taken.has(s.id));
  if (!open) {
    return { ok: false, error: `All ${input.entity} slots in ${region.name} are taken.` };
  }

  const now = new Date();
  const ends = new Date(now.getTime() + input.days * 86_400_000);
  const { error } = await service.from('ad_subscriptions').insert({
    slot_id: open.id,
    brand_id,
    dispensary_id,
    product_id,
    price_paid: 0,
    status: 'active',
    is_house: true,
    starts_at: now.toISOString(),
    ends_at: ends.toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/** End a live brand/product slot early — cancel the subscription to free the slot now. */
export async function endMerchSubscription(subscriptionId: string): Promise<void> {
  await requireAdmin();
  const service = createServiceClient();
  await service
    .from('ad_subscriptions')
    .update({ status: 'canceled', ends_at: new Date().toISOString() })
    .eq('id', subscriptionId);
  refresh();
}

/**
 * Activate a pending self-serve reservation: flip it live and restart the term
 * from now, preserving the reserved length (ends − starts). The advertiser's
 * requested slot is kept; re-target to a metro by ending it and comping there.
 */
export async function activateMerchSubscription(subscriptionId: string): Promise<void> {
  await requireAdmin();
  const service = createServiceClient();
  const { data: sub } = await service
    .from('ad_subscriptions')
    .select('id, starts_at, ends_at, status')
    .eq('id', subscriptionId)
    .maybeSingle();
  if (!sub || sub.status !== 'pending') return;

  const reservedMs =
    sub.starts_at && sub.ends_at
      ? new Date(sub.ends_at).getTime() - new Date(sub.starts_at).getTime()
      : 30 * 86_400_000;
  const now = new Date();
  await service
    .from('ad_subscriptions')
    .update({
      status: 'active',
      starts_at: now.toISOString(),
      ends_at: new Date(now.getTime() + Math.max(86_400_000, reservedMs)).toISOString(),
    })
    .eq('id', subscriptionId);
  refresh();
}
