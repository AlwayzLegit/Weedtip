'use client';

import { useMemo, useState, useTransition } from 'react';
import { requestBrandPlacement, reserveBrandSlot } from '@/app/actions/billing';
import { track } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import {
  placementPriceCents,
  PLACEMENT_MAX_DAYS,
  PLACEMENT_MIN_DAYS,
} from '@/lib/placement-pricing';

export type BrandCreativeOption = { id: string; name: string };

/** Reserve a brand promotion — directory feature or a homepage hero slot, with
 *  optional geo targeting and an attached creative. */
export function BrandPromote({
  brandId,
  creatives = [],
}: {
  brandId: string;
  creatives?: BrandCreativeOption[];
}) {
  const [kind, setKind] = useState<'promoted_brand' | 'hero'>('promoted_brand');
  const [days, setDays] = useState(30);
  const [stateCode, setStateCode] = useState('');
  const [city, setCity] = useState('');
  const [creativeId, setCreativeId] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isHero = kind === 'hero';
  const targeted = stateCode.trim().length === 2;
  const cityTargeted = targeted && city.trim().length > 0;
  // Featured-brand slots sell on the region system and reserve nationwide (the
  // team can re-target to a metro on activation); only the hero keeps the
  // legacy geo scope selector.
  const scope = isHero ? (cityTargeted ? 'city' : targeted ? 'state' : 'nationwide') : 'nationwide';
  const price = useMemo(() => placementPriceCents(kind, scope, days), [kind, scope, days]);
  const reachLabel = !isHero
    ? 'nationwide · team targets your market'
    : cityTargeted
      ? `${city.trim()}, ${stateCode.toUpperCase()}`
      : targeted
        ? stateCode.toUpperCase()
        : 'nationwide';

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
              'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ' +
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
        {isHero && (
          <>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">State</span>
              <input
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 2))}
                placeholder="Nationwide"
                maxLength={2}
                className="border-border bg-background block w-28 rounded-md border px-3 py-2 uppercase"
              />
              <span className="text-muted block text-xs">Blank = nationwide</span>
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">City (optional)</span>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value.slice(0, 80))}
                placeholder={targeted ? 'All of state' : 'Set a state first'}
                disabled={!targeted}
                className="border-border bg-background block w-40 rounded-md border px-3 py-2 disabled:opacity-50"
              />
              <span className="text-muted block text-xs">Needs a state</span>
            </label>
          </>
        )}
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
          disabled={pending}
          onClick={() => {
            setError(null);
            setNotice(null);
            track('brand_promo_requested', {
              kind,
              days,
              state: targeted ? stateCode.toUpperCase() : 'nationwide',
              city: cityTargeted ? city.trim() : null,
              has_creative: !!creativeId,
              price_cents: price,
            });
            start(async () => {
              const res = isHero
                ? await requestBrandPlacement({
                    brand_id: brandId,
                    days,
                    state: targeted ? stateCode.toUpperCase() : undefined,
                    city: cityTargeted ? city.trim() : undefined,
                    creative_id: creativeId || undefined,
                    type: 'hero',
                  })
                : await reserveBrandSlot({
                    brand_id: brandId,
                    days,
                    creative_id: creativeId || undefined,
                  });
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
