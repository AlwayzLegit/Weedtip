'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type ReviewState = { error?: string; message?: string };

const star = z.coerce.number().int().min(1).max(5);
const schema = z.object({
  dispensary_id: z.string().uuid(),
  dispensary_slug: z.string().min(1),
  quality: star,
  service: star,
  atmosphere: star,
  body: z.string().max(4000).optional(),
  photo_urls: z.array(z.string().url().max(600)).max(4).optional(),
});

/**
 * Review photos must be objects the author uploaded to OUR storage under their
 * own uid folder — anything else (hotlinks, other users' files) is dropped.
 */
function ownStoragePhotos(urls: string[] | undefined, userId: string): string[] {
  if (!urls?.length) return [];
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return [];
  const prefix = `${base}/storage/v1/object/public/dispensary-media/${userId}/`;
  return urls.filter((u) => u.startsWith(prefix)).slice(0, 4);
}

export async function submitReview(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  let photoUrls: string[] | undefined;
  const rawPhotos = formData.get('photo_urls');
  if (typeof rawPhotos === 'string' && rawPhotos) {
    try {
      photoUrls = JSON.parse(rawPhotos) as string[];
    } catch {
      photoUrls = undefined;
    }
  }
  const parsed = schema.safeParse({
    dispensary_id: formData.get('dispensary_id'),
    dispensary_slug: formData.get('dispensary_slug'),
    quality: formData.get('quality'),
    service: formData.get('service'),
    atmosphere: formData.get('atmosphere'),
    body: formData.get('body') || undefined,
    photo_urls: photoUrls,
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Please rate all three categories.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in to leave a review.' };

  const { data: dispProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();

  const { quality, service, atmosphere } = parsed.data;
  // Overall rating is the average of the three dimensions (verified is set by trigger).
  const rating = Math.round((quality + service + atmosphere) / 3);

  // One review per user per dispensary — upsert on the unique constraint.
  const { error } = await supabase.from('reviews').upsert(
    {
      dispensary_id: parsed.data.dispensary_id,
      user_id: user.id,
      rating,
      quality,
      service,
      atmosphere,
      body: parsed.data.body ?? null,
      photo_urls: ownStoragePhotos(parsed.data.photo_urls, user.id),
      author_name: dispProfile?.display_name ?? 'Weedtip member',
    },
    { onConflict: 'dispensary_id,user_id' },
  );
  if (error) return { error: error.message };

  revalidatePath(`/dispensary/${parsed.data.dispensary_slug}`);
  return { message: 'Thanks for your review!' };
}

const disputeSchema = z.object({
  review_id: z.string().uuid(),
  dispensary_slug: z.string().min(1),
  reason: z.string().max(2000).optional(),
});

/** Owner/admin disputes (or clears the dispute on) a review. */
export async function disputeReview(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const parsed = disputeSchema.safeParse({
    review_id: formData.get('review_id'),
    dispensary_slug: formData.get('dispensary_slug'),
    reason: formData.get('reason') || undefined,
  });
  if (!parsed.success) return { error: 'Invalid request.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('dispute_review', {
    p_review_id: parsed.data.review_id,
    p_reason: parsed.data.reason ?? '',
  });
  if (error) return { error: error.message };

  revalidatePath('/dashboard/reviews');
  revalidatePath(`/dispensary/${parsed.data.dispensary_slug}`);
  return { message: parsed.data.reason ? 'Review disputed — our team will review it.' : 'Dispute withdrawn.' };
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

  const { data: prodProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();

  const { error } = await supabase.from('product_reviews').upsert(
    {
      product_id: parsed.data.product_id,
      user_id: user.id,
      rating: parsed.data.rating,
      body: parsed.data.body ?? null,
      author_name: prodProfile?.display_name ?? 'Weedtip member',
    },
    { onConflict: 'product_id,user_id' },
  );
  if (error) return { error: error.message };

  revalidatePath(`/product/${parsed.data.product_id}`);
  return { message: 'Thanks for your review!' };
}

// ─── Helpful votes ───────────────────────────────────────────────────────────

export type HelpfulResult = { voted: boolean; count: number } | { error: string };

/** Toggle the caller's helpful vote on a review; returns the new state. */
export async function toggleHelpfulVote(reviewId: string): Promise<HelpfulResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in to mark reviews as helpful.' };

  const { data: existing } = await supabase
    .from('review_votes')
    .select('review_id')
    .eq('review_id', reviewId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from('review_votes').delete().eq('review_id', reviewId).eq('user_id', user.id);
  } else {
    const { error } = await supabase
      .from('review_votes')
      .insert({ review_id: reviewId, user_id: user.id });
    // RLS blocks voting on your own review; surface it politely.
    if (error) return { error: 'You can’t vote on your own review.' };
  }

  const { data: fresh } = await supabase
    .from('reviews')
    .select('helpful_count')
    .eq('id', reviewId)
    .maybeSingle();
  return { voted: !existing, count: fresh?.helpful_count ?? 0 };
}

// ─── Deletes (author-only; RLS also enforces) ────────────────────────────────

export async function deleteReview(reviewId: string, dispensarySlug: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('reviews').delete().eq('id', reviewId).eq('user_id', user.id);
  revalidatePath(`/dispensary/${dispensarySlug}`);
}

export async function deleteProductReview(reviewId: string, productId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('product_reviews').delete().eq('id', reviewId).eq('user_id', user.id);
  revalidatePath(`/product/${productId}`);
}

// ─── Owner reply (Weedmaps-style review responses) ───────────────────────────

const replySchema = z.object({
  review_id: z.string().uuid(),
  reply: z.string().max(4000).optional(),
});

export async function replyToReview(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const parsed = replySchema.safeParse({
    review_id: formData.get('review_id'),
    reply: formData.get('reply') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid reply' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in.' };

  const { error } = await supabase.rpc('reply_to_review', {
    p_review_id: parsed.data.review_id,
    p_reply: parsed.data.reply ?? '',
  });
  if (error) return { error: error.message };

  revalidatePath('/dashboard/reviews');
  const slug = formData.get('dispensary_slug');
  if (typeof slug === 'string' && slug) revalidatePath(`/dispensary/${slug}`);
  return { message: parsed.data.reply ? 'Reply published.' : 'Reply removed.' };
}
