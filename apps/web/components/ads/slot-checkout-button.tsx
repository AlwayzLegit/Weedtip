'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button';

/**
 * Self-serve slot purchase CTA. Claims a slot via /api/ads/checkout and hands
 * off to Stripe. A 409 means the region's inventory just sold out (or the
 * shop already holds this slot type here) — surfaced inline, not as an error
 * page, because scarcity is part of the pitch.
 */
export function SlotCheckoutButton({
  regionId,
  slotType,
  label,
  disabled = false,
}: {
  regionId: string;
  slotType: 'featured' | 'premium';
  label: string;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function buy() {
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch('/api/ads/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ region_id: regionId, slot_type: slotType }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        message?: string;
      };
      if (res.ok && body.url) {
        window.location.href = body.url; // hand off to Stripe Checkout
        return;
      }
      if (res.status === 401) {
        window.location.href = `/sign-in?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      setMessage(
        body.error === 'SLOT_TAKEN'
          ? (body.message ?? 'Just sold out — join the waitlist by contacting us.')
          : (body.message ?? body.error ?? 'Could not start checkout.'),
      );
    } catch {
      setMessage('Could not start checkout.');
    }
    setPending(false);
  }

  return (
    <div className="space-y-1.5">
      <Button className="w-full" onClick={buy} disabled={pending || disabled}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {disabled ? 'Sold out' : label}
      </Button>
      {message && <p className="text-danger text-xs">{message}</p>}
    </div>
  );
}
