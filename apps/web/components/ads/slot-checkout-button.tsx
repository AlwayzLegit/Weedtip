'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { track } from '@/lib/analytics';
import { Button } from '../ui/button';

/**
 * Self-serve slot reservation CTA. Claims a slot via /api/ads/checkout — the
 * hold succeeds instantly and our sales team follows up to set up billing (no
 * card is collected in-app). A 409 means the region's inventory just sold out
 * (or the shop already holds this slot type here) — surfaced inline, not as an
 * error page, because scarcity is part of the pitch.
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
  const [reserved, setReserved] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function reserve() {
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch('/api/ads/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ region_id: regionId, slot_type: slotType }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (res.ok && body.ok) {
        track('ad_slot_requested', { region_id: regionId, slot_type: slotType });
        setReserved(body.message ?? 'Slot reserved — our team will contact you to set up billing.');
        setPending(false);
        return;
      }
      if (res.status === 401) {
        window.location.href = `/sign-in?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      setMessage(
        body.error === 'SLOT_TAKEN'
          ? (body.message ?? 'Just sold out — join the waitlist by contacting us.')
          : (body.message ?? body.error ?? 'Could not reserve the slot.'),
      );
    } catch {
      setMessage('Could not reserve the slot.');
    }
    setPending(false);
  }

  if (reserved) {
    return (
      <p className="text-primary flex items-start gap-1.5 text-xs">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {reserved}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <Button className="w-full" onClick={reserve} disabled={pending || disabled}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {disabled ? 'Sold out' : label}
      </Button>
      <p className="text-muted text-center text-[11px]">No card needed — we set up billing with you.</p>
      {message && <p className="text-danger text-xs">{message}</p>}
    </div>
  );
}
