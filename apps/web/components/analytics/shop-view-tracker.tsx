'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics';

/** Fires a `shop_viewed` funnel event when a dispensary profile is opened. */
export function ShopViewTracker({
  dispensaryId,
  slug,
  name,
  city,
  state,
}: {
  dispensaryId: string;
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
}) {
  useEffect(() => {
    track('shop_viewed', { dispensary_id: dispensaryId, slug, name, city, state });
  }, [dispensaryId, slug, name, city, state]);

  return null;
}
