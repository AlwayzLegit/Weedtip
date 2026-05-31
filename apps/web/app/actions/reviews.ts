'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type ReviewState = { error?: string; message?: string };

const schema = z.object({
  dispensary_id: z.string().uuid(),
  dispensary_slug: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().max(4000).optional(),
});

export async function submitReview(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const parsed = schema.safeParse({
    dispensary_id: formData.get('dispensary_id'),
    dispensary_slug: formData.get('dispensary_slug'),
    rating: formData.get('rating'),
    body: formData.get('body') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid review' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in to leave a review.' };

  // One review per user per dispensary — upsert on the unique constraint.
  const { error } = await supabase.from('reviews').upsert(
    {
      dispensary_id: parsed.data.dispensary_id,
      user_id: user.id,
      rating: parsed.data.rating,
      body: parsed.data.body ?? null,
    },
    { onConflict: 'dispensary_id,user_id' },
  );
  if (error) return { error: error.message };

  revalidatePath(`/dispensary/${parsed.data.dispensary_slug}`);
  return { message: 'Thanks for your review!' };
}

const productReviewSchema = z.object({
  product_id: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().max(4000).optional(),
});

export async function submitProductReview(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const parsed = productReviewSchema.safeParse({
    product_id: formData.get('product_id'),
    rating: formData.get('rating'),
    body: formData.get('body') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid review' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in to leave a review.' };

  const { error } = await supabase.from('product_reviews').upsert(
    {
      product_id: parsed.data.product_id,
      user_id: user.id,
      rating: parsed.data.rating,
      body: parsed.data.body ?? null,
    },
    { onConflict: 'product_id,user_id' },
  );
  if (error) return { error: error.message };

  revalidatePath(`/product/${parsed.data.product_id}`);
  return { message: 'Thanks for your review!' };
}
