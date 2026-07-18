'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, MapPin } from 'lucide-react';
import { US_STATES } from '@/lib/seo';
import { cn } from '@/lib/utils';

export const MARKET_COOKIE = 'wt_state';

export function readMarketCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${MARKET_COOKIE}=([A-Z]{2})`));
  const code = m?.[1] ?? null;
  return code && US_STATES[code] ? code : null;
}

export function writeMarketCookie(code: string | null) {
  if (code) {
    document.cookie = `${MARKET_COOKIE}=${code}; max-age=${60 * 60 * 24 * 365}; path=/; samesite=lax`;
  } else {
    document.cookie = `${MARKET_COOKIE}=; max-age=0; path=/`;
  }
}

/**
 * IP-detected city, seeded by middleware as "city|ST" (city percent-encoded).
 * Returns null unless the pair's state matches the given market — a manual
 * state switch makes the detected city inapplicable, not wrong.
 */
export function readCityCookie(market: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|; )wt_city=([^;]+)/);
  if (!m?.[1]) return null;
  const [encCity, st] = m[1].split('|');
  if (!encCity || st !== market) return null;
  try {
    const city = decodeURIComponent(decodeURIComponent(encCity)).trim();
    return city.length >= 2 && city.length <= 60 ? city : null;
  } catch {
    return null;
  }
}

/** Fired on market change so location-driven client blocks (home feed) re-scope
    in place without a navigation. */
export const MARKET_CHANGE_EVENT = 'wt:market-change';

/** Where "switch market to {st}" should land from the current surface.
    null = stay put (the surface re-scopes itself via MARKET_CHANGE_EVENT). */
function destinationFor(pathname: string, code: string): string | null {
  const st = code.toLowerCase();
  if (pathname === '/') return null; // home feed re-scopes in place
  if (pathname.startsWith('/deals')) return `/deals/${st}`;
  if (pathname.startsWith('/brands')) return `/brands?state=${code}`;
  return `/dispensaries/${st}`;
}

/**
 * Persistent market picker (Weedmaps-style): remembers the shopper's state in
 * a client-readable cookie — so statically cached pages stay shared — and
 * navigates to the state-scoped version of the current surface on change.
 * The cookie is geo-seeded by the middleware on first visit.
 */
export function MarketSelector({ className }: { className?: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Cookie is read after mount so server HTML stays market-agnostic.
  useEffect(() => {
    setSelected(readMarketCookie());
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function choose(code: string) {
    writeMarketCookie(code);
    setSelected(code);
    setOpen(false);
    window.dispatchEvent(new CustomEvent(MARKET_CHANGE_EVENT, { detail: code }));
    const dest = destinationFor(pathname ?? '/', code);
    if (dest) router.push(dest);
  }

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="border-border text-muted hover:text-foreground hover:border-border-strong flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <MapPin className="text-primary h-4 w-4" />
        {selected ? US_STATES[selected] : 'Set location'}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && (
        <ul
          role="listbox"
          className="border-border bg-surface shadow-card absolute right-0 z-50 mt-1 max-h-80 w-56 overflow-auto rounded-lg border py-1 text-sm"
        >
          {Object.entries(US_STATES).map(([code, name]) => (
            <li key={code}>
              <button
                type="button"
                role="option"
                aria-selected={selected === code}
                onClick={() => choose(code)}
                className={cn(
                  'hover:bg-surface-2 flex w-full items-center justify-between px-3 py-2 text-left',
                  selected === code && 'text-primary font-medium',
                )}
              >
                {name}
                <span className="text-muted text-xs">{code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
