'use client';

import { useMemo, useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import {
  openBillingPortal,
  startPlacementCheckout,
  startSubscriptionCheckout,
} from '@/app/actions/billing';
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
  stripeEnabled,
  plans,
  currentPlanName,
  subscribed,
  hasBillingAccount,
  city,
  state,
  deals,
  products,
}: {
  stripeEnabled: boolean;
  plans: Plan[];
  currentPlanName: string;
  subscribed: boolean;
  hasBillingAccount: boolean;
  city: string;
  state: string;
  deals: Target[];
  products: Target[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go(action: () => Promise<{ ok: true; url: string } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.ok) window.location.href = res.url;
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

      {/* Plans */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Plans</h2>
          {stripeEnabled && hasBillingAccount && (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => go(() => openBillingPortal())}
            >
              Manage billing
            </Button>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
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
                </div>
                <p className="mt-1 text-sm font-medium">
                  {isPaid ? `${formatPrice(pl.price_cents)}/mo` : 'Free'}
                </p>
                <ul className="mt-3 flex-1 space-y-1.5">
                  {pl.features.map((f) => (
                    <li key={f} className="text-muted flex items-start gap-1.5 text-xs">
                      <Check className="text-primary mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {stripeEnabled && isPaid && !current && (
                  <div className="mt-4">
                    {subscribed ? (
                      <p className="text-muted text-xs">Use “Manage billing” to switch plans.</p>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={pending}
                        onClick={() => go(() => startSubscriptionCheckout(pl.id))}
                      >
                        Subscribe
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {!stripeEnabled && (
          <p className="text-muted text-xs">
            Online billing isn’t enabled on this environment. An admin can still assign plans
            manually.
          </p>
        )}
      </section>

      {/* Buy a placement */}
      {stripeEnabled && (
        <PlacementPurchase
          pending={pending}
          go={go}
          city={city}
          state={state}
          deals={deals}
          products={products}
        />
      )}
    </div>
  );
}

const PLACEMENT_TYPES: PlacementType[] = ['featured', 'hero', 'promoted_deal', 'promoted_product'];
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
  go: (
    action: () => Promise<{ ok: true; url: string } | { ok: false; error: string }>,
  ) => void;
  city: string;
  state: string;
  deals: Target[];
  products: Target[];
}) {
  const [type, setType] = useState<PlacementType>('featured');
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
      <h2 className="text-lg font-semibold">Buy a placement</h2>
      <p className="text-muted text-sm">
        Promote your shop, deals, or products. Price scales with reach and duration; the placement
        activates as soon as payment clears and expires automatically.
      </p>
      <div className="rounded-card border-border bg-surface space-y-4 border p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Placement</span>
            <select
              className="border-border bg-background w-full rounded-md border px-3 py-2"
              value={type}
              onChange={(e) => {
                setType(e.target.value as PlacementType);
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
              one-time · {days} day{days === 1 ? '' : 's'}
            </p>
          </div>
          <Button
            disabled={!canBuy}
            onClick={() =>
              go(() =>
                startPlacementCheckout({
                  type,
                  scope,
                  days,
                  target_id: needsTarget ? targetId : undefined,
                }),
              )
            }
          >
            Buy placement
          </Button>
        </div>
      </div>
    </section>
  );
}
