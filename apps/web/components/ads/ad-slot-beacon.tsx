'use client';

import { useEffect, useRef } from 'react';
import { track } from '@/lib/analytics';

export interface AdSlotMeta {
  slotType: 'exclusive' | 'featured' | 'premium';
  regionSlug: string;
  zoneSlug: string | null;
  dispensaryId: string;
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
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(target);

    const onClick = () => track('ad_click', props, { beacon: true });
    anchor?.addEventListener('click', onClick);

    return () => {
      io.disconnect();
      anchor?.removeEventListener('click', onClick);
    };
  }, [slot.slotType, slot.regionSlug, slot.zoneSlug, slot.dispensaryId]);

  return <span ref={ref} aria-hidden className="hidden" />;
}
