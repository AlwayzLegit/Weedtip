'use server';

import { revalidatePath } from 'next/cache';
import { type FormState, formError, formSuccess, str } from '@/lib/forms';
import { createClient } from '@/lib/supabase/server';

/** A signed-in user requests ownership of a brand (admin approves). */
export async function requestBrandClaim(brandId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in to claim a brand.' };

  const { error } = await supabase
    .from('brand_claims')
    .insert({ brand_id: brandId, user_id: user.id });
  if (error) {
    return {
      ok: false,
      error: error.code === '23505' ? 'You already requested this brand.' : error.message,
    };
  }
  return { ok: true };
}

/** Brand owner edits their brand's presentation fields (via SECURITY DEFINER RPC). */
export async function updateOwnedBrand(_prev: FormState, fd: FormData): Promise<FormState> {
  const brandId = str(fd, 'brand_id');
  if (!brandId) return formError('Missing brand.');

  const supabase = await createClient();
  const { error } = await supabase.rpc('update_owned_brand', {
    p_brand_id: brandId,
    p_description: str(fd, 'description') ?? '',
    p_logo_url: str(fd, 'logo_url') ?? '',
    p_website: str(fd, 'website') ?? '',
  });
  if (error) return formError(error.message);

  revalidatePath('/dashboard/brands');
  revalidatePath('/brands');
  return formSuccess('Saved.');
}
