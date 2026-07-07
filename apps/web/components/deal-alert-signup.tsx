'use client';

import { useState, useTransition } from 'react';
import { BellRing, Check } from 'lucide-react';
import { subscribeDealAlerts } from '@/app/actions/deal-alerts';
import { track } from '@/lib/analytics';

/**
 * Deal-alert email capture. The site's first owned marketing channel — turns
 * anonymous browsers into a reachable list. Renders as a compact band; on
 * success it swaps to a confirmation so the field doesn't invite re-submits.
 */
export function DealAlertSignup({
  source = 'footer',
  defaultState = null,
  className = '',
}: {
  source?: string;
  defaultState?: string | null;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className={`text-primary flex items-center gap-2 text-sm font-medium ${className}`}>
        <Check className="h-4 w-4" />
        You&apos;re on the list — we&apos;ll send new deals your way.
      </div>
    );
  }

  return (
    <form
      className={className}
      action={(formData) => {
        setError(null);
        start(async () => {
          const res = await subscribeDealAlerts(formData);
          if (res.ok) {
            setDone(true);
            track('deal_alert_subscribed', { source, state: defaultState });
          } else {
            setError(res.error ?? 'Something went wrong.');
          }
        });
      }}
    >
      <input type="hidden" name="source" value={source} />
      {defaultState && <input type="hidden" name="state" value={defaultState} />}
      <p className="text-foreground mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <BellRing className="text-primary h-4 w-4" />
        Get deal alerts
      </p>
      <p className="text-muted mb-3 text-sm">
        New dispensary deals{defaultState ? ` in ${defaultState}` : ' near you'}, straight to your
        inbox.
      </p>
      <div className="flex max-w-sm gap-2">
        <input
          type="email"
          name="email"
          required
          placeholder="you@email.com"
          aria-label="Email for deal alerts"
          enterKeyHint="send"
          className="border-border bg-surface focus:border-primary h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none transition-colors"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-primary bg-primary-grad text-primary-foreground inline-flex h-10 shrink-0 items-center rounded-lg px-4 text-sm font-medium disabled:opacity-60"
        >
          {pending ? 'Joining…' : 'Notify me'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </form>
  );
}
