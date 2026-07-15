'use client';

import { useActionState, useState } from 'react';
import { requestBrandClaim } from '@/app/actions/brands';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { SubmitButton } from '../auth/submit-button';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

/** Lets a signed-in owner request ownership of an unclaimed brand. */
export function ClaimBrandButton({ brandId }: { brandId: string }) {
  const [state, action] = useActionState(requestBrandClaim, EMPTY_FORM_STATE);
  const [open, setOpen] = useState(false);

  if (state.status === 'success') {
    return (
      <p className="text-primary text-sm">Claim submitted — an admin will review it shortly.</p>
    );
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Claim this brand
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="brand_id" value={brandId} />
      <Input
        name="business_email"
        type="email"
        placeholder="Business email"
        required
        maxLength={254}
      />
      <Textarea
        name="message"
        placeholder="Your role at this brand and anything that helps verify you (optional)"
        maxLength={2000}
      />
      {state.status === 'error' && state.message && (
        <p className="text-danger text-xs">{state.message}</p>
      )}
      <div className="flex gap-2">
        <SubmitButton size="sm">Submit claim</SubmitButton>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
