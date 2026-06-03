'use client';

import { useState, useTransition } from 'react';
import { requestBrandClaim } from '@/app/actions/brands';
import { Button } from '@/components/ui/button';

/** Lets a signed-in owner request ownership of an unclaimed brand. */
export function ClaimBrandButton({ brandId }: { brandId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return <p className="text-primary text-sm">Claim submitted — an admin will review it shortly.</p>;
  }

  return (
    <div>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await requestBrandClaim(brandId);
            if (res.ok) setDone(true);
            else setError(res.error ?? 'Could not submit claim.');
          })
        }
      >
        Claim this brand
      </Button>
      {error && <p className="text-danger mt-1 text-xs">{error}</p>}
    </div>
  );
}
