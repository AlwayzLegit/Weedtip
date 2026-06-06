'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function toggleBrandFollow(brandId: string, slug: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from('brand_followers')
    .select('brand_id')
    .eq('user_id', user.id)
    .eq('brand_id', brandId)
    .maybeSingle();

  if (existing) {
    await supabase.from('brand_followers').delete().eq('user_id', user.id).eq('brand_id', brandId);
  } else {
    await supabase.from('brand_followers').insert({ user_id: user.id, brand_id: brandId });
  }

  revalidatePath(`/brand/${slug}`);
}
