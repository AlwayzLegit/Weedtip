'use client';

import { useActionState, useState } from 'react';
import { Star } from 'lucide-react';
import { submitBrandReview, type BrandReviewState } from '@/app/brand/[slug]/actions';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';

/**
 * Star-rating + optional text review for a brand. One review per user per
 * brand — re-submitting replaces the previous one, so the form doubles as the
 * edit surface (seeded with the user's existing review when present).
 */
export function BrandReviewForm({
  brandId,
  slug,
  initialRating = 0,
  initialBody = '',
}: {
  brandId: string;
  slug: string;
  initialRating?: number;
  initialBody?: string;
}) {
  const [rating, setRating] = useState(initialRating);
  const [hover, setHover] = useState(0);
  const action = submitBrandReview.bind(null, brandId, slug);
  const [state, formAction, pending] = useActionState<BrandReviewState, FormData>(action, {});

  return (
    <form action={formAction} className="rounded-card border-border bg-surface border p-4">
      <p className="text-sm font-semibold">
        {initialRating > 0 ? 'Update your review' : 'Rate this brand'}
      </p>
      <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="Star rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5"
          >
            <Star
              className={cn(
                'h-6 w-6 transition-colors',
                (hover || rating) >= n ? 'text-primary fill-current' : 'text-muted',
              )}
            />
          </button>
        ))}
      </div>
      <input type="hidden" name="rating" value={rating} />
      <textarea
        name="body"
        defaultValue={initialBody}
        rows={3}
        maxLength={4000}
        placeholder="What stands out about their products? (optional)"
        className="border-border bg-surface-2 focus:border-primary mt-3 w-full rounded-lg border p-3 text-sm outline-none transition-colors"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || rating === 0}
          onClick={() => track('brand_reviewed', { slug, rating })}
          className="bg-primary bg-primary-grad text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Saving…' : initialRating > 0 ? 'Update review' : 'Post review'}
        </button>
        {state.error && <p className="text-danger text-sm">{state.error}</p>}
        {state.ok && <p className="text-primary text-sm">Review saved.</p>}
      </div>
    </form>
  );
}
