'use client';

import { useActionState } from 'react';
import { disputeReview, type ReviewState } from '@/app/actions/reviews';
import { FormMessage } from '../auth/form-message';
import { SubmitButton } from '../auth/submit-button';
import { Textarea } from '../ui/textarea';

const EMPTY: ReviewState = {};

export function DisputeForm({
  reviewId,
  dispensarySlug,
  existingReason,
}: {
  reviewId: string;
  dispensarySlug: string;
  existingReason: string | null;
}) {
  const [state, action] = useActionState(disputeReview, EMPTY);

  return (
    <details className="mt-2" open={!!existingReason}>
      <summary className="text-muted hover:text-foreground cursor-pointer text-xs">
        {existingReason ? 'Edit dispute' : 'Dispute this review'}
      </summary>
      <form action={action} className="mt-2 space-y-2">
        <input type="hidden" name="review_id" value={reviewId} />
        <input type="hidden" name="dispensary_slug" value={dispensarySlug} />
        <FormMessage state={state} />
        <Textarea
          name="reason"
          rows={2}
          defaultValue={existingReason ?? ''}
          placeholder="Why is this review inaccurate or unfair? Our team reviews disputes."
          className="text-sm"
        />
        <div className="flex items-center gap-2">
          <SubmitButton size="sm" variant="outline">
            {existingReason ? 'Update dispute' : 'Submit dispute'}
          </SubmitButton>
          {existingReason && (
            <span className="text-muted text-xs">Clear the text and save to withdraw.</span>
          )}
        </div>
      </form>
    </details>
  );
}
