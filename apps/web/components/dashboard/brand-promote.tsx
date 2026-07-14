'use client';

import { useMemo, useState, useTransition } from 'react';
import { requestBrandPlacement } from '@/app/actions/billing';
import { track } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import {
  placementPriceCents,
  PLACEMENT_MAX_DAYS,
  PLACEMENT_MIN_DAYS,
} from '@/lib/placement-pricing';

/** Reserve a brand promotion. Brands aren't geo-scoped, so reach is fixed. */
export function BrandPromote({ brandId }: { brandId: string }) {
  const [days, setDays] = useState(30);
  const [stateCode, setStateCode] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const targeted = stateCode.trim().length === 2;
  const price = useMemo(
    () => placementPriceCents('promoted_brand', targeted ? 'state' : 'nationwide', days),
    [days, targeted],
  );

  return (
    <div className="space-y-3">
      {error && (
        <p className="border-danger/30 bg-danger/10 text-danger rounded-md border px-3 py-2 text-sm">
          {error}
        </p>
      )}
      {notice && (
        <p className="border-primary/30 bg-primary-muted text-primary rounded-md border px-3 py-2 text-sm">
          {notice}
        </p>
      )}
      <p className="text-muted text-sm">
        Feature your brand on the Brands directory — nationwide or targeted to one state.
        Reserving is free; our team confirms billing before it goes live, and it expires
        automatically.
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
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Target</span>
          <input
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 2))}
            placeholder="Nationwide"
            maxLength={2}
            className="border-border bg-background block w-28 rounded-md border px-3 py-2 uppercase"
          />
          <span className="text-muted block text-xs">Blank = nationwide; or a 2-letter state</span>
        </label>
        <div>
          <p className="text-lg font-semibold">{formatPrice(price)}</p>
          <p className="text-muted text-xs">
            one-time · {days} day{days === 1 ? '' : 's'} · {targeted ? stateCode.toUpperCase() : 'nationwide'}
          </p>
        </div>
        <Button
          disabled={pending}
          onClick={() => {
            setError(null);
            setNotice(null);
            track('brand_promo_requested', { days, state: targeted ? stateCode.toUpperCase() : 'nationwide', price_cents: price });
            start(async () => {
              const res = await requestBrandPlacement({
                brand_id: brandId,
                days,
                state: targeted ? stateCode.toUpperCase() : undefined,
              });
              if (res.ok) setNotice(res.message);
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
