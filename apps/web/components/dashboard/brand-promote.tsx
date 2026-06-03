'use client';

import { useMemo, useState, useTransition } from 'react';
import { startBrandPlacementCheckout } from '@/app/actions/billing';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import {
  placementPriceCents,
  PLACEMENT_MAX_DAYS,
  PLACEMENT_MIN_DAYS,
} from '@/lib/placement-pricing';

/** Buy a nationwide brand promotion. Brands aren't geo-scoped, so reach is fixed. */
export function BrandPromote({
  brandId,
  stripeEnabled,
}: {
  brandId: string;
  stripeEnabled: boolean;
}) {
  const [days, setDays] = useState(30);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const price = useMemo(() => placementPriceCents('promoted_brand', 'nationwide', days), [days]);

  if (!stripeEnabled) {
    return (
      <p className="text-muted text-sm">
        Online billing isn’t enabled on this environment yet — an admin can place a brand promotion
        manually.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="border-danger/30 bg-danger/10 text-danger rounded-md border px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <p className="text-muted text-sm">
        Feature your brand nationwide on the Brands directory. Activates as soon as payment clears
        and expires automatically.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Duration (days)</span>
          <input
            type="number"
            min={PLACEMENT_MIN_DAYS}
            max={PLACEMENT_MAX_DAYS}
            className="border-border bg-background block w-28 rounded-md border px-3 py-2"
            value={days}
            onChange={(e) =>
              setDays(
                Math.min(
                  PLACEMENT_MAX_DAYS,
                  Math.max(PLACEMENT_MIN_DAYS, Math.round(Number(e.target.value) || 0)),
                ),
              )
            }
          />
        </label>
        <div>
          <p className="text-lg font-semibold">{formatPrice(price)}</p>
          <p className="text-muted text-xs">
            one-time · {days} day{days === 1 ? '' : 's'}
          </p>
        </div>
        <Button
          disabled={pending}
          onClick={() => {
            setError(null);
            start(async () => {
              const res = await startBrandPlacementCheckout({ brand_id: brandId, days });
              if (res.ok) window.location.href = res.url;
              else setError(res.error);
            });
          }}
        >
          Promote brand
        </Button>
      </div>
    </div>
  );
}
