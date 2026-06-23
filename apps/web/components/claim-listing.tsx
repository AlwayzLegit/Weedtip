'use client';

import { Store } from 'lucide-react';
import { useActionState, useState } from 'react';
import { requestOwnership, withdrawOwnership } from '@/app/actions/ownership';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { SubmitButton } from './auth/submit-button';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

/**
 * "Claim this listing" CTA shown to dispensary-owner accounts on unclaimed, active
 * listings. Submits an ownership request an admin reviews. Reflects an existing
 * request's status so owners aren't prompted to claim twice.
 */
export function ClaimListing({
  dispensaryId,
  slug,
  existingStatus,
  legalName,
  licenseNumber,
}: {
  dispensaryId: string;
  slug: string;
  existingStatus: 'pending' | 'approved' | 'rejected' | null;
  /** Registered name + license # from the DCC record, shown so a claimer can verify the listing. */
  legalName?: string | null;
  licenseNumber?: string | null;
}) {
  const [state, action] = useActionState(requestOwnership, EMPTY_FORM_STATE);
  const [open, setOpen] = useState(false);

  if (existingStatus === 'pending' || state.status === 'success') {
    return (
      <div className="rounded-card border-primary/30 bg-primary-muted border p-4 text-sm">
        <p className="text-primary font-medium">Ownership claim submitted</p>
        <p className="text-muted mt-1">
          An admin will review your claim and attach this listing to your dashboard once approved.
        </p>
        <form action={withdrawOwnership.bind(null, dispensaryId, slug)} className="mt-3">
          <Button type="submit" size="sm" variant="ghost">
            Withdraw claim
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-card border-border bg-surface border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Own this dispensary?</p>
          <p className="text-muted text-sm">
            Claim this listing to manage its menu, deals, and orders.
          </p>
          {(legalName || licenseNumber) && (
            <p className="text-muted mt-1 text-xs">
              On file with the state licensing authority:{legalName ? ` ${legalName}` : ''}
              {legalName && licenseNumber ? ' · ' : ' '}
              {licenseNumber ? `License ${licenseNumber}` : ''}
            </p>
          )}
        </div>
        {!open && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Store className="h-4 w-4" /> Claim listing
          </Button>
        )}
      </div>

      {open && (
        <form action={action} className="mt-4 space-y-3">
          <input type="hidden" name="dispensary_id" value={dispensaryId} />
          <input type="hidden" name="slug" value={slug} />
          {existingStatus === 'rejected' && (
            <p className="text-muted text-sm">
              Your previous claim was declined. Add details below and try again.
            </p>
          )}
          <Input name="license_number" placeholder="State license # (helps us verify)" maxLength={120} />
          <Textarea
            name="message"
            placeholder="Anything that helps verify you own this dispensary (optional)"
            maxLength={2000}
          />
          {state.status === 'error' && state.message && (
            <p className="border-danger/40 bg-danger/10 text-danger rounded-lg border px-3 py-2 text-sm">
              {state.message}
            </p>
          )}
          <div className="flex gap-2">
            <SubmitButton size="sm">Submit claim</SubmitButton>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
