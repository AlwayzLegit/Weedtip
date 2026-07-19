'use client';

import { useState, useTransition } from 'react';
import { BellPlus, CheckCircle2, Loader2 } from 'lucide-react';
import { requestAdAvailability, type AdRequestResult } from '@/app/actions/ads';
import { Button } from '../ui/button';

/**
 * Sold-out inventory CTA: joins the waitlist (an actionable row on the admin
 * Ad desk) instead of dead-ending at "TAKEN". Scarcity stays part of the
 * pitch — the copy tells the buyer they're in line for the next opening.
 */
export function RequestAvailabilityButton({
  regionId,
  slotType,
}: {
  regionId: string;
  slotType: 'featured' | 'premium' | 'exclusive';
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AdRequestResult | null>(null);

  if (result?.ok) {
    return (
      <p className="text-primary flex items-center gap-1.5 text-sm font-medium">
        <CheckCircle2 className="h-4 w-4" /> {result.message}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () =>
            setResult(await requestAdAvailability({ region_id: regionId, slot_type: slotType })),
          )
        }
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellPlus className="h-4 w-4" />}
        Request availability
      </Button>
      {result && !result.ok && <p className="text-danger text-xs">{result.message}</p>}
    </div>
  );
}
