'use client';

import { useState, useTransition } from 'react';
import { startPosAddonCheckout } from '@/app/actions/billing';
import { Button } from '@/components/ui/button';

export function PosAddonButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        size="lg"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await startPosAddonCheckout();
            if (res.ok) window.location.href = res.url;
            else setError(res.error);
          });
        }}
      >
        Enable POS add-on · $99/mo
      </Button>
      {error && <p className="text-danger text-xs">{error}</p>}
    </div>
  );
}
