'use client';

import { useEffect } from 'react';

/**
 * Records one first-party `search` ad_event when a shopper views a
 * zone/region-resolved browse surface (city pages). These counts are the
 * demand signal in the region pricing model — ISR-cached pages can't log
 * server-side, so the client beacons once per view. Renders nothing.
 */
export function RegionSearchBeacon({
  regionId,
  zoneId,
}: {
  regionId: string;
  zoneId: string | null;
}) {
  useEffect(() => {
    const body = JSON.stringify({ event: 'search', region_id: regionId, zone_id: zoneId });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/ads/track', body);
    else void fetch('/api/ads/track', { method: 'POST', body, keepalive: true });
  }, [regionId, zoneId]);

  return null;
}
