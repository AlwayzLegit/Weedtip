'use client';

import { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { requestBrandPlanChange } from '@/app/actions/billing';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Mirrors the Basic-tier BRAND_FEATURES labels (lib/brand-plan.ts, server-only)
// so this client card can show what an upgrade unlocks without importing it.
const BASIC_BENEFITS = ['Complete brand profile', 'Brand updates', 'Brand analytics'];

/**
 * Brand Studio plan card: shows the brand's current tier and a one-click
 * "request Basic" for free brands (sales-led — lands as a pending
 * brand_subscription that /admin/billing activates).
 */
export function BrandPlanRequest({
  brandId,
  isPaid,
  pending,
  basic,
}: {
  brandId: string;
  isPaid: boolean;
  pending: boolean;
  basic: { id: string; priceCents: number } | null;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upgrade() {
    if (!basic) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    const r = await requestBrandPlanChange(brandId, basic.id);
    setBusy(false);
    if (r.ok) setMsg(r.message ?? 'Request sent.');
    else setErr(r.error);
  }

  return (
    <div className="border-border bg-surface-2 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="text-primary h-4 w-4" /> Brand Studio plan
          </p>
          <p className="text-muted mt-0.5 text-xs">
            {isPaid
              ? 'Basic is active — your full profile, updates, and analytics are unlocked.'
              : 'Free — your brand page and catalog are live. Upgrade to complete your profile, post updates, and see analytics.'}
          </p>
        </div>
        {isPaid ? (
          <Badge tone="primary">Basic</Badge>
        ) : pending ? (
          <Badge tone="muted">Requested</Badge>
        ) : basic ? (
          <Button size="sm" onClick={upgrade} disabled={busy}>
            <Sparkles className="h-4 w-4" /> Upgrade to Basic · ${Math.round(basic.priceCents / 100)}/mo
          </Button>
        ) : null}
      </div>

      {!isPaid && (
        <ul className="text-muted mt-3 grid gap-1.5 text-xs sm:grid-cols-3">
          {BASIC_BENEFITS.map((b) => (
            <li key={b} className="flex items-center gap-1.5">
              <Check className="text-primary h-3.5 w-3.5 shrink-0" /> {b}
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="text-primary mt-2 text-xs">{msg}</p>}
      {err && <p className="text-danger mt-2 text-xs">{err}</p>}
    </div>
  );
}
