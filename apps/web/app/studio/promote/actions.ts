'use server';

import { revalidatePath } from 'next/cache';
import { formError, formSuccess, type FormState } from '@/lib/forms';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Brand ad-creative library — the brand-side mirror of the dispensary creatives
 * in app/dashboard/actions.ts. A creative is a reusable image + headline + body
 * that a brand attaches to a placement (e.g. a homepage hero) so the ad renders
 * the custom art instead of the brand's plain logo.
 *
 * ad_creatives writes are admin-only under RLS, so — like requestBrandPlacement
 * — we verify brand ownership against the user, then write with the service
 * client. Image upload itself happens client-side via <ImagePicker> into the
 * public dispensary-media bucket (keyed by user id), same as the shop flow.
 */

/** Resolve the brand id iff the current user owns it; null otherwise. */
async function ownedBrandId(brandId: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('brands')
    .select('id, owner_id')
    .eq('id', brandId)
    .maybeSingle();
  return data && data.owner_id === user.id ? data.id : null;
}

export async function saveBrandAdCreative(_prev: FormState, fd: FormData): Promise<FormState> {
  const brandId = String(fd.get('brand_id') ?? '');
  const name = String(fd.get('name') ?? '').trim();
  const imageUrl = String(fd.get('image_url') ?? '').trim();
  const headline = String(fd.get('headline') ?? '').trim() || null;
  const body = String(fd.get('body') ?? '').trim() || null;
  if (!name || name.length > 80) return formError('Creative name is required (max 80 chars).');
  if (!imageUrl) return formError('Upload or pick an image for the creative.');
  if (headline && headline.length > 80) return formError('Headline is 80 characters max.');
  if (body && body.length > 140) return formError('Body copy is 140 characters max.');

  const owned = await ownedBrandId(brandId);
  if (!owned) return formError('You do not own this brand.');

  const service = createServiceClient();
  const { error } = await service
    .from('ad_creatives')
    .insert({ brand_id: owned, name, image_url: imageUrl, headline, body });
  if (error) return formError(error.message);
  revalidatePath('/studio/promote');
  return formSuccess('Creative saved to your library.');
}

/** Remove a brand creative (live placements keep rendering the brand logo —
    placements.creative_id nulls via FK). Only the owning brand's user can. */
export async function deleteBrandAdCreative(creativeId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const service = createServiceClient();
  const { data: creative } = await service
    .from('ad_creatives')
    .select('id, brand_id')
    .eq('id', creativeId)
    .maybeSingle();
  if (!creative?.brand_id) return;
  const { data: brand } = await service
    .from('brands')
    .select('owner_id')
    .eq('id', creative.brand_id)
    .maybeSingle();
  if (!brand || brand.owner_id !== user.id) return;

  await service.from('ad_creatives').delete().eq('id', creativeId);
  revalidatePath('/studio/promote');
}
