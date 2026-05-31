'use client';

import { Star } from 'lucide-react';
import { useActionState, useState } from 'react';
import { submitReview, type ReviewState } from '@/app/actions/reviews';
import { cn } from '@/lib/utils';
import { FormMessage } from './auth/form-message';
import { SubmitButton } from './auth/submit-button';
import { Textarea } from './ui/textarea';

export function ReviewForm({
  dispensaryId,
  dispensarySlug,
  initialRating = 0,
  initialBody = '',
}: {
  dispensaryId: string;
  dispensarySlug: string;
  initialRating?: number;
  initialBody?: string;
}) {
  const [state, action] = useActionState<ReviewState, FormData>(submitReview, {});
  const [rating, setRating] = useState(initialRating);
  const [hover, setHover] = useState(0);

  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <input type="hidden" name="dispensary_id" value={dispensaryId} />
      <input type="hidden" name="dispensary_slug" value={dispensarySlug} />
      <input type="hidden" name="rating" value={rating} />

      <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setRating(i)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${i} star${i > 1 ? 's' : ''}`}
            aria-checked={rating === i}
            role="radio"
          >
            <Star
              className={cn(
                'h-7 w-7 transition-colors',
                i <= (hover || rating) ? 'fill-primary text-primary' : 'text-border',
              )}
            />
          </button>
        ))}
      </div>

      <Textarea
        name="body"
        placeholder="Share your experience (optional)"
        defaultValue={initialBody}
        maxLength={4000}
      />
      <SubmitButton disabled={rating === 0}>Submit review</SubmitButton>
    </form>
  );
}
