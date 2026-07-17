'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { requestBrandPlanChange } from '@/app/actions/billing';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
              ? 'Basic is active — your catalog, analytics, and updates are unlocked.'
              : 'Free — your brand page is live. Upgrade to publish your catalog, post updates, and see analytics.'}
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
      {msg && <p className="text-primary mt-2 text-xs">{msg}</p>}
      {err && <p className="text-danger mt-2 text-xs">{err}</p>}
    </div>
  );
}
