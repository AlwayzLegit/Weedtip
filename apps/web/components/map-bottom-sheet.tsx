'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export type SheetSnap = 'peek' | 'half' | 'full';

// peek (carousel over the map) → half → full, cycled by tapping the grabber.
const ORDER: SheetSnap[] = ['peek', 'half', 'full'];

/**
 * Mobile-only draggable bottom sheet for the map browser (Weedmaps/Google-Maps
 * pattern): the map is full-bleed and this sheet overlays its bottom edge with
 * three snap points — a shallow **peek** (the swipeable card carousel), **half**,
 * and near-**full** (the scrollable result list). Drag the grabber to snap, or
 * tap it to cycle taller (gesture-free path for a11y / reduced dexterity). Snap
 * heights track the map container so it scales to any device, and the sheet
 * clears the home-indicator via `env(safe-area-inset-bottom)`.
 *
 * `snap` is lifted to the parent so a pin tap can bring the sheet forward.
 */
export function MapBottomSheet({
  snap,
  onSnapChange,
  peek,
  children,
  label,
}: {
  snap: SheetSnap;
  onSnapChange: (next: SheetSnap) => void;
  /** Shallow-state body — the horizontal card carousel. */
  peek: React.ReactNode;
  /** Expanded-state body — the scrollable vertical result list. */
  children: React.ReactNode;
  /** Compact status line shown beside the grabber (e.g. "12 nearby"). */
  label?: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState({ peek: 132, half: 340, full: 560 });
  const [dragH, setDragH] = useState<number | null>(null);
  const drag = useRef<{ startY: number; startH: number; moved: number } | null>(null);

  // Snap heights follow the map container (the sheet's offset parent) so the
  // sheet is proportional on any viewport; peek stays a fixed teaser height.
  useEffect(() => {
    const parent = rootRef.current?.parentElement;
    if (!parent) return;
    const measure = () => {
      const h = parent.clientHeight;
      if (!h) return;
      setHeights({ peek: 132, half: Math.round(h * 0.52), full: Math.round(h * 0.92) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  const clamp = useCallback(
    (h: number) => Math.min(Math.max(h, heights.peek), heights.full),
    [heights],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startH: heights[snap], moved: 0 };
    setDragH(heights[snap]);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.startY - e.clientY; // up (toward taller) is positive
    d.moved = Math.max(d.moved, Math.abs(dy));
    setDragH(clamp(d.startH + dy));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* capture may already be released on cancel */
    }
    if (!d) return;
    // Negligible travel = a tap: cycle to the next taller snap, wrapping at full.
    if (d.moved < 6) {
      const i = ORDER.indexOf(snap);
      onSnapChange(ORDER[(i + 1) % ORDER.length] ?? 'peek');
      setDragH(null);
      return;
    }
    // Snap to whichever of the three heights the drag landed nearest.
    const landed = dragH ?? heights[snap];
    const nearest = ORDER.reduce((best, s) =>
      Math.abs(heights[s] - landed) < Math.abs(heights[best] - landed) ? s : best,
    );
    onSnapChange(nearest);
    setDragH(null);
  };

  const height = dragH ?? heights[snap];
  // Once past the peek teaser, swap the carousel out for the scrollable list.
  const expanded = height > heights.peek + 48;

  return (
    <div
      ref={rootRef}
      className="absolute inset-x-0 bottom-0 z-20 lg:hidden"
      style={{
        height,
        transition: dragH == null ? 'height 0.28s cubic-bezier(0.32,0.72,0,1)' : 'none',
      }}
    >
      <div className="bg-surface border-border shadow-card-hover flex h-full flex-col overflow-hidden rounded-t-2xl border-x border-t">
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-label={`Results — ${
            snap === 'full' ? 'expanded' : snap === 'half' ? 'half open' : 'collapsed'
          }. Drag or tap to resize.`}
          className="flex w-full shrink-0 touch-none flex-col items-center gap-1 px-4 pb-1.5 pt-2.5"
        >
          <span className="bg-border h-1.5 w-10 rounded-full" aria-hidden />
          {label && <span className="text-muted text-xs">{label}</span>}
        </button>
        <div
          className={cn(
            'min-h-0 flex-1',
            expanded ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden',
          )}
        >
          {expanded ? children : peek}
        </div>
      </div>
    </div>
  );
}
