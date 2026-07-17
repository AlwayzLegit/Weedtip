'use server';

import { revalidatePath } from 'next/cache';
import { getAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export type BrandReviewState = { ok?: boolean; error?: string };

/**
 * Create or replace the signed-in user's review of a brand (one per user per
 * brand — the unique constraint makes re-submits an update). The rating
 * aggregate on brands syncs via trigger.
 */
export async function submitBrandReview(
  brandId: string,
  slug: string,
  _prev: BrandReviewState,
  formData: FormData,
): Promise<BrandReviewState> {
  const { user, profile } = await getAuth();
  if (!user) return { error: 'Sign in to review brands.' };

  const rating = Number(formData.get('rating'));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: 'Pick a star rating.' };
  }
  const body = String(formData.get('body') ?? '').trim().slice(0, 4000) || null;

  const supabase = await createClient();
  const { error } = await supabase.from('brand_reviews').upsert(
    {
      brand_id: brandId,
      user_id: user.id,
      rating,
      body,
      author_name: profile?.display_name ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'brand_id,user_id' },
  );
  if (error) return { error: 'Could not save your review — try again.' };

  revalidatePath(`/brand/${slug}`);
  return { ok: true };
}
