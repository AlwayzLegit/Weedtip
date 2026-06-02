'use client';

import { useActionState } from 'react';
import { replyToReview, type ReviewState } from '@/app/actions/reviews';
import { FormMessage } from '../auth/form-message';
import { SubmitButton } from '../auth/submit-button';
import { Textarea } from '../ui/textarea';

const EMPTY: ReviewState = {};

export function ReplyForm({
  reviewId,
  dispensarySlug,
  existingReply,
}: {
  reviewId: string;
  dispensarySlug: string;
  existingReply: string | null;
}) {
  const [state, action] = useActionState(replyToReview, EMPTY);

  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="review_id" value={reviewId} />
      <input type="hidden" name="dispensary_slug" value={dispensarySlug} />
      <FormMessage state={state} />
      <Textarea
        name="reply"
        rows={2}
        defaultValue={existingReply ?? ''}
        placeholder="Write a public response…"
        className="text-sm"
      />
      <div className="flex items-center gap-2">
        <SubmitButton size="sm">{existingReply ? 'Update response' : 'Respond'}</SubmitButton>
        {existingReply && (
          <span className="text-muted text-xs">Clear the text and save to remove your reply.</span>
        )}
      </div>
    </form>
  );
}
