'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/** Toggle the signed-in user's "save" on a strain. */
export async function toggleStrainFavorite(
  strainId: string,
  slug: string,
): Promise<{ ok: boolean; saved?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in to save strains.' };

  const { data: existing } = await supabase
    .from('strain_favorites')
    .select('strain_id')
    .eq('strain_id', strainId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('strain_favorites')
      .delete()
      .eq('strain_id', strainId)
      .eq('user_id', user.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/strain/${slug}`);
    return { ok: true, saved: false };
  }

  const { error } = await supabase
    .from('strain_favorites')
    .insert({ strain_id: strainId, user_id: user.id });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/strain/${slug}`);
  return { ok: true, saved: true };
}
