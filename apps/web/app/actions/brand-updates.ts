'use server';

import { revalidatePath } from 'next/cache';
import { BRAND_UPGRADE_MESSAGE, canUseBrandFeature } from '@/lib/brand-plan';
import { type FormState, formError, formSuccess, str } from '@/lib/forms';
import { createClient } from '@/lib/supabase/server';

/** Brand owner posts an update; the RPC fans it out to followers as notifications. */
export async function postBrandUpdate(_prev: FormState, fd: FormData): Promise<FormState> {
  const brandId = str(fd, 'brand_id');
  const title = str(fd, 'title');
  if (!brandId) return formError('Missing brand.');
  if (!title) return formError('An update needs a title.');

  // Basic-tier feature (admins + grandfathered brands pass). RLS still enforces
  // that the caller actually owns this brand.
  if (!(await canUseBrandFeature(brandId, 'brand_updates'))) return formError(BRAND_UPGRADE_MESSAGE);

  const supabase = await createClient();
  const { error } = await supabase.rpc('post_brand_update', {
    p_brand_id: brandId,
    p_title: title,
    p_body: str(fd, 'body') ?? '',
  });
  if (error) return formError(error.message);

  revalidatePath('/studio/updates');
  return formSuccess('Update posted to your followers.');
}

export async function deleteBrandUpdate(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('brand_updates').delete().eq('id', id);
  revalidatePath('/studio/updates');
}
