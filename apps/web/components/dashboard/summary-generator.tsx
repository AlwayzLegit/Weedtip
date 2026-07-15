'use client';

import { useActionState } from 'react';
import { Sparkles } from 'lucide-react';
import { generateReviewsSummary } from '@/app/dashboard/actions';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { SubmitButton } from '../auth/submit-button';

/** Owner-triggered "generate/refresh AI review summary" button. */
export function SummaryGenerator({ hasSummary }: { hasSummary: boolean }) {
  const [state, action] = useActionState(generateReviewsSummary, EMPTY_FORM_STATE);
  return (
    <form action={action} className="shrink-0">
      <SubmitButton variant="outline" size="sm">
        <Sparkles className="h-4 w-4" /> {hasSummary ? 'Refresh summary' : 'Generate summary'}
      </SubmitButton>
      {state.status === 'error' && <p className="text-danger mt-1 text-xs">{state.message}</p>}
      {state.status === 'success' && <p className="text-primary mt-1 text-xs">{state.message}</p>}
    </form>
  );
}
