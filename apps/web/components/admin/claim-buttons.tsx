'use client';

import { approveOwnershipRequest, rejectOwnershipRequest } from '@/app/admin/actions';
import { Button } from '../ui/button';

export function ClaimButtons({ id, weak = false }: { id: string; weak?: boolean }) {
  // A weak claim has no automatic proof (no license match, no email-domain match,
  // no document) — approving it hands over a regulated listing on trust alone, so
  // make the admin confirm rather than one-click it.
  function guardWeakApprove(e: React.FormEvent<HTMLFormElement>) {
    if (
      weak &&
      !window.confirm(
        'This claim has no verification signals (no license match, no email-domain match, no document). Approve anyway and give this account control of the listing?',
      )
    ) {
      e.preventDefault();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={approveOwnershipRequest.bind(null, id)} onSubmit={guardWeakApprove}>
        <Button type="submit" size="sm" variant={weak ? 'outline' : 'primary'}>
          Approve
        </Button>
      </form>
      <form action={rejectOwnershipRequest.bind(null, id)}>
        <Button type="submit" size="sm" variant="outline">
          Reject
        </Button>
      </form>
    </div>
  );
}
