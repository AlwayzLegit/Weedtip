'use client';

import { useEffect, useRef } from 'react';

function send(id: string, type: 'impression' | 'click') {
  const body = JSON.stringify({ id, type });
  // sendBeacon survives navigation (important for click → page change).
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/placements/track', body);
  } else {
    void fetch('/api/placements/track', { method: 'POST', body, keepalive: true });
  }
}

/**
 * Drop inside a placement card (which is an <a>). Records one impression when the
 * card first becomes visible, and a click when its anchor is activated. Renders
 * nothing — it wires onto the nearest ancestor anchor so server-rendered cards
 * don't have to become client components.
 */
export function PlacementBeacon({ placementId }: { placementId: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const anchor = el.closest('a');
    const target: Element = anchor ?? el;

    let counted = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !counted) {
          counted = true;
          send(placementId, 'impression');
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(target);

    const onClick = () => send(placementId, 'click');
    anchor?.addEventListener('click', onClick);

    return () => {
      io.disconnect();
      anchor?.removeEventListener('click', onClick);
    };
  }, [placementId]);

  return <span ref={ref} aria-hidden className="hidden" />;
}
