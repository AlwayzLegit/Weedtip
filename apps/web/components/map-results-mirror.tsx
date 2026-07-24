'use client';

import { useRef, useState } from 'react';
import { formatDistance } from '@/lib/format';
import type { BrowserShop } from './browse-map';

/**
 * T9 — an accessible, keyboard-navigable mirror of the map's numbered pins.
 * Canvas/WebGL pins are invisible to assistive tech (true of Weedmaps too), so
 * this renders the same result set as a visually-hidden but focusable `role=
 * "list"`: each item carries an aria-label (rank, name, rating, distance, open
 * state), arrow keys cycle focus, focusing an item highlights its pin on the
 * map (via the shared hover feature-state), and Enter opens the listing. It
 * regenerates whenever `shops` changes — i.e. on every bounds query.
 */
export function MapResultsMirror({
  shops,
  onFocusShop,
  onBlur,
}: {
  shops: BrowserShop[];
  /** Focused item → highlight its pin (reuses the hover feature-state). */
  onFocusShop: (slug: string) => void;
  /** Focus left the mirror entirely → clear the highlight. */
  onBlur: () => void;
}) {
  const [active, setActive] = useState(0);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  function focusItem(i: number) {
    const clamped = Math.max(0, Math.min(i, shops.length - 1));
    setActive(clamped);
    itemRefs.current[clamped]?.focus();
  }

  function label(s: BrowserShop, rank: number): string {
    const parts = [`${rank}.`, s.name];
    if (s.rating > 0) parts.push(`rated ${s.rating.toFixed(1)} of 5`);
    const dist = formatDistance(s.distanceMeters ?? null);
    if (dist) parts.push(dist);
    if (s.isOpenNow === true) parts.push('open now');
    else if (s.isOpenNow === false) parts.push('closed');
    return parts.join(', ');
  }

  if (shops.length === 0) return null;

  return (
    <nav
      aria-label="Map results — keyboard accessible list"
      className="sr-only"
      onBlur={(e) => {
        // Only clear when focus leaves the mirror entirely (not on item→item).
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onBlur();
      }}
    >
      <p>
        {shops.length} {shops.length === 1 ? 'result' : 'results'} on the map. Use the arrow keys to
        move between them; press Enter to open a listing.
      </p>
      <ul>
        {shops.map((s, i) => (
          <li key={s.id}>
            <a
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              href={`/dispensary/${s.slug}`}
              tabIndex={i === active ? 0 : -1}
              aria-label={label(s, i + 1)}
              onFocus={() => {
                setActive(i);
                onFocusShop(s.slug);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                  e.preventDefault();
                  focusItem(i + 1);
                } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                  e.preventDefault();
                  focusItem(i - 1);
                } else if (e.key === 'Home') {
                  e.preventDefault();
                  focusItem(0);
                } else if (e.key === 'End') {
                  e.preventDefault();
                  focusItem(shops.length - 1);
                }
              }}
            >
              {s.name}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
