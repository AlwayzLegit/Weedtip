'use client';

import { approveBrandClaim, rejectBrandClaim } from '@/app/admin/actions';
import { Button } from '../ui/button';

export function BrandClaimButtons({ id }: { id: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={approveBrandClaim.bind(null, id)}>
        <Button type="submit" size="sm">
          Approve
        </Button>
      </form>
      <form action={rejectBrandClaim.bind(null, id)}>
        <Button type="submit" size="sm" variant="outline">
          Reject
        </Button>
      </form>
    </div>
  );
}
