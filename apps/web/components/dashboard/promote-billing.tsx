'use client';

import { useMemo, useState, useTransition } from 'react';
import { Check, MapPin } from 'lucide-react';
import {
  cancelPlan,
  requestPlacement,
  requestPlanChange,
  reserveHeroSlotForShop,
  reserveProductSlot,
  type BillingRequestResult,
} from '@/app/actions/billing';
import { track } from '@/lib/analytics';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import {
  placementPriceCents,
  PLACEMENT_MAX_DAYS,
  PLACEMENT_MIN_DAYS,
  PLACEMENT_SCOPE_LABEL,
  PLACEMENT_TYPE_LABEL,
  type PlacementScope,
  type PlacementType,
} from '@/lib/placement-pricing';

type Plan = { id: string; name: string; price_cents: number; features: string[] };
type Target = { id: string; label: string };

/** The ad region a paid plan's included Featured placement will cover. */
export type PlanCoverage = {
  regionName: string;
  regionSlug: string;
  /** Neighborhoods/zones inside the region. */
  zoneNames: string[];
  /** Featured slots still open in the region (null when unknown). */
  featuredOpen: number | null;
};

export function PromoteBilling({
  plans,
  currentPlanName,
  planPending,
  city,
  state,
  deals,
  products,
  creatives = [],
  section = 'all',
  coverage = null,
}: {
  plans: Plan[];
  currentPlanName: string;
  /** A paid-plan request is awaiting activation by the Weedtip team. */
  planPending: boolean;
  city: string;
  state: string;
  deals: Target[];
  products: Target[];
  /** Creative library entries attachable to the placement (spec ⑥). */
  creatives?: Target[];
  /** Render just the plan picker, just the placement form, or both. */
  section?: 'all' | 'plans' | 'placements';
  /** Region the paid plan's Featured placement covers — shown before upgrading. */
  coverage?: PlanCoverage | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function go(action: () => Promise<BillingRequestResult>) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await action();
      if (res.ok) setNotice(res.message);
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-card border-danger/30 bg-danger/10 text-danger border px-4 py-2 text-sm">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-card border-primary/30 bg-primary-muted text-primary border px-4 py-2 text-sm">
          {notice}
        </p>
      )}

      {/* Plans */}
      {section !== 'placements' && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Plans</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {plans.map((pl) => {
              const current = currentPlanName === pl.name;
              const isPaid = pl.price_cents > 0;
              return (
                <div
                  key={pl.id}
                  className={`rounded-card bg-surface flex flex-col border p-5 ${
                    current ? 'border-primary' : 'border-border'
                  }`}
                >
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-semibold">{pl.name}</h3>
                    {current && <Badge tone="primary">Current</Badge>}
                    {!current && isPaid && planPending && <Badge tone="muted">Requested</Badge>}
                  </div>
                  <p className="mt-1 text-sm font-medium">
                    {isPaid ? `${formatPrice(pl.price_cents)}/mo` : 'Free forever'}
                  </p>
                  <ul className="mt-3 flex-1 space-y-1.5">
                    {pl.features.map((f) => (
                      <li key={f} className="text-muted flex items-start gap-1.5 text-xs">
                        <Check className="text-primary mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* Answer "what area does this cover?" before they commit. */}
                  {isPaid && coverage && (
                    <div className="border-primary/25 bg-primary-subtle mt-3 rounded-lg border p-3">
                      <p className="text-primary flex items-center gap-1.5 text-xs font-semibold">
                        <MapPin className="h-3.5 w-3.5" /> Covers {coverage.regionName}
                      </p>
                      {coverage.zoneNames.length > 0 && (
                        <p className="text-muted mt-1 text-[11px] leading-relaxed">
                          {coverage.zoneNames.slice(0, 8).join(' · ')}
                          {coverage.zoneNames.length > 8
                            ? ` · +${coverage.zoneNames.length - 8} more`
                            : ''}
                        </p>
                      )}
                      <p className="text-muted mt-1 text-[11px]">
                        {coverage.featuredOpen === null
                          ? 'Your Featured spot covers every zone in this region.'
                          : coverage.featuredOpen > 0
                            ? `${coverage.featuredOpen} of 3 Featured spots open here — yours covers every zone in the region.`
                            : 'Featured is full here right now — you go to the front of the waitlist.'}
                      </p>
                    </div>
                  )}
                  {!current && (
                    <div className="mt-4">
                      <Button
                        size="sm"
                        className="w-full"
                        variant={isPaid ? 'primary' : 'outline'}
                        disabled={pending || (isPaid && planPending)}
                        onClick={() => {
                          if (isPaid)
                            track('plan_change_requested', {
                              plan: pl.name,
                              price_cents: pl.price_cents,
                            });
                          go(() => requestPlanChange(pl.id));
                        }}
                      >
                        {isPaid
                          ? planPending
                            ? 'Request sent'
                            : `Upgrade to ${pl.name}`
                          : 'Switch to Free'}
                      </Button>
                      {isPaid && (
                        <p className="text-muted mt-1.5 text-center text-[11px]">
                          {coverage
                            ? `Covers ${coverage.regionName} · no card needed — our team sets up billing with you.`
                            : 'No card needed — our team sets up billing with you.'}
                        </p>
                      )}
                    </div>
                  )}
                  {current && isPaid && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-4 w-full"
                      disabled={pending}
                      onClick={() => go(() => cancelPlan())}
                    >
                      Cancel plan
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Reserve a placement */}
      {section !== 'plans' && (
        <PlacementPurchase
          pending={pending}
          go={go}
          city={city}
          state={state}
          deals={deals}
          products={products}
          creatives={creatives}
        />
      )}
    </div>
  );
}

// Brand promotions are bought from the brand dashboard, not here.
type DispensaryPlacementType = Exclude<PlacementType, 'promoted_brand'>;
const PLACEMENT_TYPES: DispensaryPlacementType[] = [
  'featured',
  'hero',
  'promoted_deal',
  'promoted_product',
];
const SCOPES: PlacementScope[] = ['city', 'state', 'nationwide'];

function PlacementPurchase({
  pending,
  go,
  city,
  state,
  deals,
  products,
  creatives,
}: {
  pending: boolean;
  go: (action: () => Promise<BillingRequestResult>) => void;
  city: string;
  state: string;
  deals: Target[];
  products: Target[];
  creatives: Target[];
}) {
  const [type, setType] = useState<DispensaryPlacementType>('featured');
  const [scope, setScope] = useState<PlacementScope>('city');
  const [days, setDays] = useState(30);
  const [targetId, setTargetId] = useState('');
  const [creativeId, setCreativeId] = useState('');
  const [startDate, setStartDate] = useState('');

  const needsTarget = type === 'promoted_deal' || type === 'promoted_product';
  const targets = type === 'promoted_deal' ? deals : type === 'promoted_product' ? products : [];
  // Featured products and the homepage hero sell on the region system and
  // reserve nationwide (the team targets a metro on activation), so the geo
  // Reach selector doesn't apply to them.
  const isRegionReserve = type === 'promoted_product' || type === 'hero';
  const effectiveScope: PlacementScope = isRegionReserve ? 'nationwide' : scope;
  const price = useMemo(
    () => placementPriceCents(type, effectiveScope, days),
    [type, effectiveScope, days],
  );

  const scopeLabel = (s: PlacementScope) =>
    s === 'city' ? `${city} only` : s === 'state' ? `${state} statewide` : 'Nationwide';

  const canBuy = !pending && days >= PLACEMENT_MIN_DAYS && (!needsTarget || !!targetId);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Promote your shop</h2>
      <p className="text-muted text-sm">
        Promote your shop, deals, or products. Price scales with reach and duration; reserving is
        free — our team confirms billing before anything goes live, and the placement expires
        automatically.
      </p>
      <div className="rounded-card border-border bg-surface space-y-4 border p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Placement</span>
            <select
              className="border-border bg-background w-full rounded-md border px-3 py-2"
              value={type}
              onChange={(e) => {
                setType(e.target.value as DispensaryPlacementType);
                setTargetId('');
              }}
            >
              {PLACEMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PLACEMENT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Reach</span>
            {isRegionReserve ? (
              <div className="border-border bg-background text-muted flex h-[42px] items-center rounded-md border px-3 py-2 text-sm">
                Nationwide · our team targets your market
              </div>
            ) : (
              <select
                className="border-border bg-background w-full rounded-md border px-3 py-2"
                value={scope}
                onChange={(e) => setScope(e.target.value as PlacementScope)}
              >
                {SCOPES.map((s) => (
                  <option key={s} value={s}>
                    {PLACEMENT_SCOPE_LABEL[s]} — {scopeLabel(s)}
                  </option>
                ))}
              </select>
            )}
          </label>

          {needsTarget && (
            <label className="space-y-1.5 text-sm sm:col-span-2">
              <span className="font-medium">
                {type === 'promoted_deal' ? 'Which deal' : 'Which product'}
              </span>
              <select
                className="border-border bg-background w-full rounded-md border px-3 py-2"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
              >
                <option value="">Select…</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              {targets.length === 0 && (
                <span className="text-muted text-xs">
                  No {type === 'promoted_deal' ? 'active deals' : 'products'} to promote yet.
                </span>
              )}
            </label>
          )}

          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Duration (days)</span>
            <input
              type="number"
              min={PLACEMENT_MIN_DAYS}
              max={PLACEMENT_MAX_DAYS}
              className="border-border bg-background w-full rounded-md border px-3 py-2"
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
            <span className="font-medium">Start date (optional)</span>
            <input
              type="date"
              className="border-border bg-background w-full rounded-md border px-3 py-2"
              value={startDate}
              min={new Date().toISOString().slice(0, 10)}
              max={new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10)}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-muted text-xs">
              Schedule ahead (up to 90 days) — blank starts when our team confirms.
            </span>
          </label>

          <label className="space-y-1.5 text-sm sm:col-span-2">
            <span className="font-medium">Creative (optional)</span>
            <select
              className="border-border bg-background w-full rounded-md border px-3 py-2"
              value={creativeId}
              onChange={(e) => setCreativeId(e.target.value)}
            >
              <option value="">Storefront photo (default)</option>
              {creatives.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            {creatives.length === 0 && (
              <span className="text-muted text-xs">
                Build one in the creative library below to run custom ad art + copy.
              </span>
            )}
          </label>
        </div>

        <div className="border-border flex items-center justify-between border-t pt-4">
          <div>
            <p className="text-lg font-semibold">{formatPrice(price)}</p>
            <p className="text-muted text-xs">
              one-time · {days} day{days === 1 ? '' : 's'} · billed after our team confirms
            </p>
          </div>
          <Button
            disabled={!canBuy}
            onClick={() => {
              track('placement_requested', {
                type,
                scope: effectiveScope,
                days,
                price_cents: price,
              });
              // Featured products and the homepage hero sell on the unified
              // region ad-slot system now (reserved nationwide; the team can
              // re-target to a metro). Every other placement type still runs on
              // the legacy placements flow.
              go(() =>
                type === 'promoted_product'
                  ? reserveProductSlot({ product_id: targetId, days })
                  : type === 'hero'
                    ? reserveHeroSlotForShop({ days, creative_id: creativeId || undefined })
                    : requestPlacement({
                        type,
                        scope,
                        days,
                        target_id: needsTarget ? targetId : undefined,
                        creative_id: creativeId || undefined,
                        start_date: startDate || undefined,
                      }),
              );
            }}
          >
            Reserve placement
          </Button>
        </div>
      </div>
    </section>
  );
}
