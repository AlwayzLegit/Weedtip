'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function toggleFavorite(dispensaryId: string, slug: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from('favorites')
    .select('dispensary_id')
    .eq('user_id', user.id)
    .eq('dispensary_id', dispensaryId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('dispensary_id', dispensaryId);
  } else {
    await supabase.from('favorites').insert({ user_id: user.id, dispensary_id: dispensaryId });
  }

  revalidatePath(`/dispensary/${slug}`);
}
