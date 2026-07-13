'use client';

import { useMemo, useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import {
  cancelPlan,
  requestPlacement,
  requestPlanChange,
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

export function PromoteBilling({
  plans,
  currentPlanName,
  planPending,
  city,
  state,
  deals,
  products,
}: {
  plans: Plan[];
  currentPlanName: string;
  /** A paid-plan request is awaiting activation by the Weedtip team. */
  planPending: boolean;
  city: string;
  state: string;
  deals: Target[];
  products: Target[];
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
                {!current && (
                  <div className="mt-4">
                    <Button
                      size="sm"
                      className="w-full"
                      variant={isPaid ? 'primary' : 'outline'}
                      disabled={pending || (isPaid && planPending)}
                      onClick={() => {
                        if (isPaid) track('plan_change_requested', { plan: pl.name, price_cents: pl.price_cents });
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
                        No card needed — our team sets up billing with you.
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

      {/* Reserve a placement */}
      <PlacementPurchase
        pending={pending}
        go={go}
        city={city}
        state={state}
        deals={deals}
        products={products}
      />
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
}: {
  pending: boolean;
  go: (action: () => Promise<BillingRequestResult>) => void;
  city: string;
  state: string;
  deals: Target[];
  products: Target[];
}) {
  const [type, setType] = useState<DispensaryPlacementType>('featured');
  const [scope, setScope] = useState<PlacementScope>('city');
  const [days, setDays] = useState(30);
  const [targetId, setTargetId] = useState('');

  const needsTarget = type === 'promoted_deal' || type === 'promoted_product';
  const targets = type === 'promoted_deal' ? deals : type === 'promoted_product' ? products : [];
  const price = useMemo(() => placementPriceCents(type, scope, days), [type, scope, days]);

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
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <div>
            <p className="text-lg font-semibold">{formatPrice(price)}</p>
            <p className="text-muted text-xs">
              one-time · {days} day{days === 1 ? '' : 's'} · billed after our team confirms
            </p>
          </div>
          <Button
            disabled={!canBuy}
            onClick={() => {
              track('placement_requested', { type, scope, days, price_cents: price });
              go(() =>
                requestPlacement({
                  type,
                  scope,
                  days,
                  target_id: needsTarget ? targetId : undefined,
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
