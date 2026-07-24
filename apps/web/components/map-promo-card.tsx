'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Star, Tag, X } from 'lucide-react';
import { track } from '@/lib/analytics';
import { formatDistance } from '@/lib/format';
import { MediaImage } from './media-image';

export interface MapPromoAd {
  slug: string;
  name: string;
  coverImageUrl: string | null;
  logoUrl: string | null;
  rating: number;
  reviewCount: number;
  distanceMeters: number | null;
  dealBadge?: string | null;
  lat: number;
  lng: number;
}

const ROTATE_MS = 6000;

/**
 * On-map rotating sponsored ad unit (Weedmaps' map ad card, audit T1). Overlays
 * the map — bottom-right on desktop, bottom-center above the mobile toggle —
 * and cycles the viewport's paid placements. Clicking flies the map to the
 * advertiser's pin and opens its listing. Honors prefers-reduced-motion (no
 * auto-rotate; manual prev/next), pauses on hover/focus, and is dismissable.
 */
export function MapPromoCard({
  ads,
  onAdClick,
}: {
  ads: MapPromoAd[];
  onAdClick: (ad: MapPromoAd) => void;
}) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [reduce, setReduce] = useState(false);
  const n = ads.length;

  useEffect(() => {
    setReduce(
      typeof window !== 'undefined' &&
        !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    );
  }, []);

  // Keep the index in range as the viewport's ad set changes under us.
  useEffect(() => {
    if (i >= n && n > 0) setI(0);
  }, [n, i]);

  // Auto-rotate — skipped under reduced-motion or while paused (WCAG 2.2.2).
  useEffect(() => {
    if (reduce || paused || n <= 1) return;
    const t = setInterval(() => setI((p) => (p + 1) % n), ROTATE_MS);
    return () => clearInterval(t);
  }, [reduce, paused, n]);

  // One impression per distinct ad shown.
  const lastTracked = useRef<string | null>(null);
  const ad = n > 0 ? ads[i % n] : undefined;
  useEffect(() => {
    if (!ad || dismissed) return;
    if (lastTracked.current === ad.slug) return;
    lastTracked.current = ad.slug;
    track('map_promo_impression', { slug: ad.slug });
  }, [ad, dismissed]);

  if (!ad || dismissed) return null;

  const distance = formatDistance(ad.distanceMeters ?? null);
  const go = (d: number) => setI((p) => (((p + d) % n) + n) % n);

  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-36 z-20 flex justify-center sm:inset-x-auto sm:bottom-4 sm:right-4 sm:block">
      <div
        className="rounded-card border-border bg-surface shadow-card pointer-events-auto relative w-full max-w-[300px] overflow-hidden border"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        <button
          type="button"
          aria-label="Dismiss ad"
          onClick={() => setDismissed(true)}
          className="bg-background/70 hover:bg-background focus-visible:ring-primary absolute right-1.5 top-1.5 z-10 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => {
            track('map_promo_click', { slug: ad.slug });
            onAdClick(ad);
          }}
          className="block w-full text-left"
        >
          <MediaImage
            url={ad.coverImageUrl ?? ad.logoUrl}
            alt={ad.name}
            className="h-24"
            iconClassName="h-8 w-8"
          >
            <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black shadow">
              Ad
            </span>
          </MediaImage>
          <div className="space-y-1 p-3">
            <p className="truncate text-sm font-semibold">{ad.name}</p>
            <p className="text-muted flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              {ad.rating > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <Star className="text-primary h-3 w-3 fill-current" />
                  {ad.rating.toFixed(1)}
                  {ad.reviewCount ? ` (${ad.reviewCount})` : ''}
                </span>
              )}
              {distance && (
                <span className="inline-flex items-center gap-0.5">
                  <MapPin className="h-3 w-3" />
                  {distance}
                </span>
              )}
            </p>
            {ad.dealBadge && (
              <span className="bg-primary-muted text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold">
                <Tag className="h-3 w-3" />
                {ad.dealBadge}
              </span>
            )}
          </div>
        </button>

        {n > 1 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous ad"
              onClick={() => go(-1)}
              className="glass flex h-8 w-8 items-center justify-center rounded-full"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Next ad"
              onClick={() => go(1)}
              className="glass flex h-8 w-8 items-center justify-center rounded-full"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
