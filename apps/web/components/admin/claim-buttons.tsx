'use client';

import { approveOwnershipRequest, rejectOwnershipRequest } from '@/app/admin/actions';
import { Button } from '../ui/button';

export function ClaimButtons({ id }: { id: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={approveOwnershipRequest.bind(null, id)}>
        <Button type="submit" size="sm">
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
