'use client';

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Horizontal merchandising row (Weedmaps-style): swipe/scroll on touch,
 * arrow paddles on pointer devices, snap-aligned cards. Server components
 * pass fully rendered cards as children; each child gets a fixed-width
 * snap cell via `itemClassName`.
 */
export function ScrollCarousel({
  children,
  itemClassName = 'w-72',
  className,
  ariaLabel,
}: {
  children: ReactNode;
  /** Width class for each cell, e.g. "w-72" or "w-40 sm:w-48". */
  itemClassName?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    update();
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);

  const nudge = (dir: 1 | -1) => {
    const el = scroller.current;
    el?.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  return (
    <div className={cn('group relative', className)}>
      <div
        ref={scroller}
        onScroll={update}
        role={ariaLabel ? 'region' : undefined}
        aria-label={ariaLabel}
        className="scrollbar-none -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-1"
      >
        {Children.map(children, (child) =>
          child == null ? null : (
            <div className={cn('shrink-0 snap-start', itemClassName)}>{child}</div>
          ),
        )}
      </div>

      {/* Edge fades: on hover the first/last card slides under a soft scrim so
          the paddle never sits on sharp content. Pointer-through. */}
      {canLeft && (
        <div
          aria-hidden
          className="from-background pointer-events-none absolute inset-y-0 -left-1 z-[5] hidden w-12 bg-gradient-to-r to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 motion-reduce:transition-none sm:block"
        />
      )}
      {canRight && (
        <div
          aria-hidden
          className="from-background pointer-events-none absolute inset-y-0 -right-1 z-[5] hidden w-12 bg-gradient-to-l to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 motion-reduce:transition-none sm:block"
        />
      )}

      {/* Paddles reveal on hover only — at rest nothing overlays the cards. */}
      {canLeft && (
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => nudge(-1)}
          className="border-border bg-surface text-foreground shadow-card-hover hover:border-primary/50 absolute -left-3 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none sm:flex"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {canRight && (
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => nudge(1)}
          className="border-border bg-surface text-foreground shadow-card-hover hover:border-primary/50 absolute -right-3 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none sm:flex"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
