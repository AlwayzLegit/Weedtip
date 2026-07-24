'use client';

import { useMemo, useState, useTransition } from 'react';
import { reserveBrandSlot, reserveHeroSlotForBrand } from '@/app/actions/billing';
import { track } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import {
  placementPriceCents,
  PLACEMENT_MAX_DAYS,
  PLACEMENT_MIN_DAYS,
} from '@/lib/placement-pricing';

export type BrandCreativeOption = { id: string; name: string };

/** Reserve a brand promotion — a Featured Brands slot or a homepage hero slot.
 *  Both sell on the region ad-slot system and reserve nationwide (the team can
 *  target a metro on activation); an optional creative supplies custom art. */
export function BrandPromote({
  brandId,
  creatives = [],
}: {
  brandId: string;
  creatives?: BrandCreativeOption[];
}) {
  const [kind, setKind] = useState<'promoted_brand' | 'hero'>('promoted_brand');
  const [days, setDays] = useState(30);
  // Raw text while typing — clamping per keystroke turns "clear, type 30" into 130→90.
  const [daysRaw, setDaysRaw] = useState('30');
  const [creativeId, setCreativeId] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isHero = kind === 'hero';
  const price = useMemo(() => placementPriceCents(kind, 'nationwide', days), [kind, days]);
  const reachLabel = 'nationwide · team targets your market';

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
      {/* Placement type: directory feature vs the homepage hero carousel. */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['promoted_brand', 'Promoted brand'],
            ['hero', 'Homepage hero'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={
              'rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ' +
              (kind === k
                ? 'border-primary bg-primary-muted text-primary'
                : 'border-border text-muted hover:text-foreground')
            }
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-muted text-sm">
        {kind === 'hero'
          ? 'Claim a slot in the homepage hero carousel — your brand rotates alongside dispensaries, nationwide or targeted to a state or city. Reserving is free; our team confirms billing before it goes live, and it expires automatically.'
          : 'Reserve a Featured Brands slot on the Brands directory. Reserved nationwide — our team can target it to your market on activation. Reserving is free; we confirm billing before it goes live, and it expires automatically.'}
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Duration (days)</span>
          <input
            type="number"
            min={PLACEMENT_MIN_DAYS}
            max={PLACEMENT_MAX_DAYS}
            className="border-border bg-background block w-28 rounded-md border px-3 py-2"
            value={daysRaw}
            onChange={(e) => setDaysRaw(e.target.value)}
            onBlur={() => {
              const n = Math.min(
                PLACEMENT_MAX_DAYS,
                Math.max(PLACEMENT_MIN_DAYS, Math.round(Number(daysRaw) || 0)),
              );
              setDays(n);
              setDaysRaw(String(n));
            }}
          />
        </label>
      </div>

      {/* Attach a custom creative (image + headline) — otherwise the ad uses the
          brand logo. Manage creatives in the library below. */}
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Ad creative (optional)</span>
        <select
          value={creativeId}
          onChange={(e) => setCreativeId(e.target.value)}
          className="border-border bg-background block w-full max-w-xs rounded-md border px-3 py-2"
        >
          <option value="">Brand logo (default)</option>
          {creatives.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {creatives.length === 0 && (
          <span className="text-muted block text-xs">
            No creatives yet — add one in the library below to customize your ad art.
          </span>
        )}
      </label>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-lg font-semibold">{formatPrice(price)}</p>
          <p className="text-muted text-xs">
            one-time · {days} day{days === 1 ? '' : 's'} · {reachLabel}
          </p>
        </div>
        <Button
          // A completed reservation must not be double-submittable; errors keep the button live for retry.
          disabled={pending || !!notice}
          onClick={() => {
            setError(null);
            setNotice(null);
            track('brand_promo_requested', {
              kind,
              days,
              scope: 'nationwide',
              has_creative: !!creativeId,
              price_cents: price,
            });
            start(async () => {
              const payload = { brand_id: brandId, days, creative_id: creativeId || undefined };
              const res = isHero
                ? await reserveHeroSlotForBrand(payload)
                : await reserveBrandSlot(payload);
              if (res.ok) setNotice(res.message);
              else setError(res.error);
            });
          }}
        >
          {kind === 'hero' ? 'Claim hero slot' : 'Reserve featured slot'}
        </Button>
      </div>
    </div>
  );
}
