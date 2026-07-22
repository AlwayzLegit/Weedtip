'use client';

import { useActionState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { setOrderingEnabled } from '@/app/admin/settings/actions';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { Badge } from '@/components/ui/badge';
import { SubmitButton } from '@/components/auth/submit-button';

/**
 * Super-admin kill-switch for consumer online ordering/checkout. While OFF, the
 * site is marketing-only — no add-to-bag, cart, or checkout anywhere, and the
 * create_order RPC refuses orders server-side (payment-processor compliant). ON
 * restores the full ordering flow once bank approval lands.
 */
export function CheckoutSwitchCard({ enabled }: { enabled: boolean }) {
  const [state, action] = useActionState(setOrderingEnabled, EMPTY_FORM_STATE);

  return (
    <div className="rounded-card border-border bg-surface border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <ShoppingCart className="text-primary h-4 w-4" /> Online ordering &amp; checkout
        </h3>
        {enabled ? (
          <Badge tone="primary">On — checkout live</Badge>
        ) : (
          <Badge tone="muted">Off — marketing only</Badge>
        )}
      </div>
      <p className="text-muted mt-1 text-xs">
        Global kill-switch for consumer ordering. While <strong>off</strong>, every add-to-bag,
        cart, and checkout surface is hidden and order creation is refused server-side — the
        platform markets dispensaries without taking their orders (payment-processor compliant).
        Turn it <strong>on</strong> to restore the full checkout flow once bank approval lands.
        Dispensary listings, menus, prices, deals, and advertising are unaffected either way.
      </p>
      <form action={action} className="mt-3">
        {/* Submit the opposite of the current state. */}
        <input type="hidden" name="enable" value={enabled ? 'false' : 'true'} />
        <SubmitButton size="sm" variant={enabled ? 'outline' : 'primary'}>
          {enabled ? 'Disable checkout sitewide' : 'Enable checkout sitewide'}
        </SubmitButton>
      </form>
      {state.status === 'error' && state.message && (
        <p className="text-danger mt-2 text-xs">{state.message}</p>
      )}
      {state.status === 'success' && state.message && (
        <p className="text-primary mt-2 text-xs">{state.message}</p>
      )}
    </div>
  );
}
