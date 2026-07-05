'use client';

import { useEffect, useRef } from 'react';
import { track } from '@/lib/analytics';

/** First-party metrics beacon (region pricing inputs) — mirrors PostHog. */
function sendAdEvent(slot: AdSlotMeta, event: 'impression' | 'click') {
  if (!slot.regionId) return;
  const body = JSON.stringify({
    event,
    region_id: slot.regionId,
    zone_id: slot.zoneId ?? null,
    dispensary_id: slot.dispensaryId,
    slot_type: slot.slotType,
  });
  if (navigator.sendBeacon) navigator.sendBeacon('/api/ads/track', body);
  else void fetch('/api/ads/track', { method: 'POST', body, keepalive: true });
}

export interface AdSlotMeta {
  slotType: 'exclusive' | 'featured' | 'premium';
  regionSlug: string;
  zoneSlug: string | null;
  dispensaryId: string;
  /** When set, the beacon also records first-party ad_events (pricing inputs). */
  regionId?: string;
  zoneId?: string | null;
}

/**
 * Drop inside a sponsored card (which is an <a>). Fires one PostHog
 * `ad_impression` when the card first becomes half-visible, and an `ad_click`
 * (beaconed — it races navigation) when the anchor is activated. These events
 * feed future dynamic region pricing, so their shape must stay stable.
 * Renders nothing; wires onto the nearest ancestor anchor so server-rendered
 * cards don't have to become client components.
 */
export function AdSlotBeacon({ slot }: { slot: AdSlotMeta }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const anchor = el.closest('a');
    const target: Element = anchor ?? el;
    const props = {
      slot_type: slot.slotType,
      region_slug: slot.regionSlug,
      zone_slug: slot.zoneSlug,
      dispensary_id: slot.dispensaryId,
    };

    let counted = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !counted) {
          counted = true;
          track('ad_impression', props);
          sendAdEvent(slot, 'impression');
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(target);

    const onClick = () => {
      track('ad_click', props, { beacon: true });
      sendAdEvent(slot, 'click');
    };
    anchor?.addEventListener('click', onClick);

    return () => {
      io.disconnect();
      anchor?.removeEventListener('click', onClick);
    };
  }, [slot.slotType, slot.regionSlug, slot.zoneSlug, slot.dispensaryId, slot.regionId, slot.zoneId]);

  return <span ref={ref} aria-hidden className="hidden" />;
}
