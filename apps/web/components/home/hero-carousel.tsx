'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'next-view-transitions';
import { ChevronLeft, ChevronRight, MapPin, Star } from 'lucide-react';
import { MediaImage } from '@/components/media-image';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type HeroSlide = {
  /** Paid hero placement id; empty string for organic (unsold-slot) slides. */
  placementId: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  coverUrl: string | null;
  rating: number | null;
  reviewCount: number;
};

function track(id: string, type: 'impression' | 'click') {
  const body = JSON.stringify({ id, type });
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon('/api/placements/track', body);
  } else {
    void fetch('/api/placements/track', { method: 'POST', body, keepalive: true });
  }
}

/**
 * Rotating promoted hero banner (Weedmaps-style "Ad" carousel), driven by paid
 * `hero` placements. Auto-advances, supports manual nav, and records an
 * impression per slide shown + a click on the CTA.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [i, setI] = useState(0);
  const [touchX, setTouchX] = useState<number | null>(null);
  const n = slides.length;
  const go = useCallback((idx: number) => setI(((idx % n) + n) % n), [n]);

  useEffect(() => {
    if (n <= 1) return;
    const t = setInterval(() => setI((p) => (p + 1) % n), 5500);
    return () => clearInterval(t);
  }, [n]);

  useEffect(() => {
    const s = slides[i];
    // Organic filler slides have no placement — nothing to bill/track.
    if (s?.placementId) track(s.placementId, 'impression');
  }, [i, slides]);

  const s = slides[i];
  if (!s) return null;

  return (
    <section aria-label="Featured partners" aria-roledescription="carousel">
      <div
        className="rounded-2xl border-border bg-surface shadow-card relative overflow-hidden border"
        // Mobile hides the arrow buttons, so swiping is the manual nav there.
        onTouchStart={(e) => setTouchX(e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          const start = touchX;
          setTouchX(null);
          const end = e.changedTouches[0]?.clientX;
          if (start == null || end == null || n <= 1) return;
          const dx = end - start;
          if (Math.abs(dx) > 48) go(dx < 0 ? i + 1 : i - 1);
        }}
      >
        <Link
          href={`/dispensary/${s.slug}`}
          onClick={() => s.placementId && track(s.placementId, 'click')}
          className="block"
        >
          <MediaImage
            url={s.coverUrl}
            alt={s.name}
            className="h-64 sm:h-80"
            iconClassName="h-16 w-16"
            sizes="(max-width: 1024px) 100vw, 1024px"
          >
            <div
              className="from-background via-background/40 absolute inset-0 bg-gradient-to-t to-transparent"
              aria-hidden
            />
            <Badge tone="primary" className="absolute left-4 top-4">
              {s.placementId ? 'Sponsored' : 'Featured'}
            </Badge>
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">{s.name}</h2>
              <p className="text-muted mt-1.5 flex items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" /> {s.city}, {s.state}
                </span>
                {typeof s.rating === 'number' && s.rating > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Star className="text-primary h-4 w-4 fill-current" />
                    {s.rating.toFixed(1)}
                    {s.reviewCount ? ` (${s.reviewCount})` : ''}
                  </span>
                )}
              </p>
              <span className="bg-primary bg-primary-grad text-primary-foreground shadow-glow-sm mt-4 inline-flex h-10 items-center rounded-lg px-5 text-sm font-medium">
                Visit shop
              </span>
            </div>
          </MediaImage>
        </Link>

        {n > 1 && (
          <>
            {/* Arrows overlap the slide title on phones — swipe covers mobile. */}
            <button
              type="button"
              aria-label="Previous"
              onClick={() => go(i - 1)}
              className="glass absolute left-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full sm:flex"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => go(i + 1)}
              className="glass absolute right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full sm:flex"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2">
              {slides.map((sl, idx) => (
                <button
                  key={sl.placementId || sl.slug}
                  type="button"
                  aria-label={`Go to slide ${idx + 1}`}
                  aria-current={idx === i}
                  onClick={() => go(idx)}
                  // Generous hit area around a small visual dot (thumb-friendly).
                  className="group flex h-8 items-center px-2.5"
                >
                  <span
                    className={cn(
                      'h-1.5 rounded-full transition-all',
                      idx === i
                        ? 'bg-primary w-6'
                        : 'bg-foreground/40 group-hover:bg-foreground/70 w-1.5',
                    )}
                  />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
