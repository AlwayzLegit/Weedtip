'use client';

import { useActionState, useState } from 'react';
import { ShieldCheck, UserMinus, UserPlus } from 'lucide-react';
import {
  releaseBrandOwner,
  releaseDispensaryOwner,
  setGrandfathered,
  transferOwnership,
} from '@/app/admin/ownership/actions';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { SubmitButton } from '../auth/submit-button';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';

/** Toggle a shop's grandfathered (free tier-1) flag. */
export function GrandfatherToggle({
  dispensaryId,
  enabled,
}: {
  dispensaryId: string;
  enabled: boolean;
}) {
  return (
    <form action={setGrandfathered.bind(null, dispensaryId, !enabled)}>
      <SubmitButton
        variant={enabled ? 'outline' : 'ghost'}
        size="sm"
        title={
          enabled
            ? 'Grandfathered: keeps Basic-tier features free. Click to revoke.'
            : 'Not grandfathered. Click to grant free Basic-tier access.'
        }
        className={cn(enabled && 'text-primary border-primary/40')}
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        {enabled ? 'Grandfathered' : 'Grandfather'}
      </SubmitButton>
    </form>
  );
}

/** Release ownership (returns the record to the unowned pool). */
export function ReleaseOwnerButton({ kind, id }: { kind: 'dispensary' | 'brand'; id: string }) {
  const action = kind === 'dispensary' ? releaseDispensaryOwner : releaseBrandOwner;
  return (
    <form action={action.bind(null, id)}>
      <SubmitButton
        variant="ghost"
        size="sm"
        className="text-danger hover:bg-danger/10"
        title="Remove the owner — the record returns to the unowned pool."
      >
        <UserMinus className="h-3.5 w-3.5" />
        Release
      </SubmitButton>
    </form>
  );
}

/** Transfer a record to another account, by email. */
export function TransferOwnerForm({ kind, id }: { kind: 'dispensary' | 'brand'; id: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(transferOwnership, EMPTY_FORM_STATE);

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} title="Transfer to another account">
        <UserPlus className="h-3.5 w-3.5" />
        Transfer
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <Input
        name="email"
        type="email"
        required
        placeholder="new-owner@email.com"
        className="h-8 w-56 text-xs"
        aria-label="New owner email"
      />
      <SubmitButton size="sm">Transfer</SubmitButton>
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {state.status === 'error' && <p className="text-danger w-full text-xs">{state.message}</p>}
      {state.status === 'success' && <p className="text-primary w-full text-xs">{state.message}</p>}
    </form>
  );
}
