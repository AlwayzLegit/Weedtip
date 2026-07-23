'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Admin hero desk actions. The homepage hero carousel is a merchandising
 * surface: sold slots come through the sales-led flow (activated in
 * /admin/billing), but the team also needs to COMP house heroes to fill the
 * carousel with chosen partners while regions ramp up, and to END a slot early.
 */

export type HeroActionResult = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath('/admin/hero');
  revalidatePath('/'); // the hero is served on the homepage
}

const compSchema = z.object({
  target: z.enum(['dispensary', 'brand']),
  slug: z.string().trim().min(1).max(120),
  scope_state: z
    .string()
    .trim()
    .length(2)
    .transform((s) => s.toUpperCase())
    .optional(),
  scope_city: z.string().trim().min(1).max(80).optional(),
  days: z.number().int().min(1).max(365),
});
export type CompHeroInput = z.infer<typeof compSchema>;

/** Comp a house hero: create an ACTIVE, $0 hero placement immediately. */
export async function compHeroPlacement(raw: CompHeroInput): Promise<HeroActionResult> {
  await requireAdmin();
  const parsed = compSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid input.' };
  }
  const input = parsed.data;
  if (input.scope_city && !input.scope_state) {
    return { ok: false, error: 'City targeting needs a state.' };
  }

  const service = createServiceClient();
  let dispensary_id: string | null = null;
  let brand_id: string | null = null;
  if (input.target === 'dispensary') {
    const { data } = await service
      .from('dispensaries')
      .select('id, status')
      .eq('slug', input.slug)
      .maybeSingle();
    if (!data) return { ok: false, error: 'No dispensary with that slug.' };
    if (data.status !== 'active') return { ok: false, error: 'That dispensary is not active.' };
    dispensary_id = data.id;
  } else {
    const { data } = await service.from('brands').select('id').eq('slug', input.slug).maybeSingle();
    if (!data) return { ok: false, error: 'No brand with that slug.' };
    brand_id = data.id;
  }

  const now = new Date();
  const end = new Date(now.getTime() + input.days * 86_400_000);
  const { error } = await service.from('placements').insert({
    dispensary_id,
    brand_id,
    type: 'hero',
    scope_state: input.scope_state ?? null,
    scope_city: input.scope_city ?? null,
    is_active: true,
    status: 'active',
    starts_at: now.toISOString(),
    ends_at: end.toISOString(),
    price_cents: 0,
    notes: `House hero (comped) · ${input.days} day${input.days === 1 ? '' : 's'}`,
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/** End a live hero early — drop it from the carousel now (serving filters is_active). */
export async function endHeroPlacement(placementId: string): Promise<void> {
  await requireAdmin();
  const service = createServiceClient();
  await service
    .from('placements')
    .update({ is_active: false, ends_at: new Date().toISOString() })
    .eq('id', placementId)
    .eq('type', 'hero');
  refresh();
}

/** Reject a pending hero request (delete it). */
export async function rejectHeroPlacement(placementId: string): Promise<void> {
  await requireAdmin();
  const service = createServiceClient();
  await service
    .from('placements')
    .delete()
    .eq('id', placementId)
    .eq('type', 'hero')
    .eq('status', 'pending');
  refresh();
}
