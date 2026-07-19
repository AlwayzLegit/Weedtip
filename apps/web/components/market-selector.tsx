'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Crosshair, Loader2, MapPin, Search, X } from 'lucide-react';
import { dispensariesUrlForPlace, geocodePlaces, reverseGeocode, type GeoPlace } from '@/lib/geocode';
import { US_STATES } from '@/lib/seo';
import { cn } from '@/lib/utils';

export const MARKET_COOKIE = 'wt_state';
/** Human label for the chosen place ("Pasadena, CA"), shown in the header. */
export const LOCATION_LABEL_COOKIE = 'wt_loc_label';

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
 * IP-detected or user-chosen city, stored as "city|ST" (city percent-encoded).
 * Returns null unless the pair's state matches the given market — a manual
 * state switch makes the detected city inapplicable, not wrong.
 */
export function readCityCookie(market: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|; )wt_city=([^;]+)/);
  if (!m?.[1]) return null;
  // Two writers, two transport shapes: the modal writes `encCity|ST` with a
  // literal pipe via document.cookie, but the middleware's value goes through
  // Next's cookie serializer, which percent-encodes the WHOLE value (pipe →
  // %7C). When no literal pipe survives, peel that outer layer first —
  // otherwise the IP-seeded cookie is unreadable and never scopes the feed.
  let raw = m[1];
  if (!raw.includes('|')) {
    try {
      raw = decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  const [encCity, st] = raw.split('|');
  if (!encCity || st !== market) return null;
  try {
    const city = decodeURIComponent(decodeURIComponent(encCity)).trim();
    return city.length >= 2 && city.length <= 60 ? city : null;
  } catch {
    return null;
  }
}

function readLabelCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${LOCATION_LABEL_COOKIE}=([^;]+)`));
  try {
    return m?.[1] ? decodeURIComponent(m[1]).slice(0, 60) : null;
  } catch {
    return null;
  }
}

/** Fired on market change so location-driven client blocks (home feed) re-scope
    in place without a navigation. */
export const MARKET_CHANGE_EVENT = 'wt:market-change';

/** Where "switch market to {st}" should land from the current surface.
    null = stay put (the surface re-scopes itself via MARKET_CHANGE_EVENT). */
function destinationFor(pathname: string, code: string, place: GeoPlace | null): string | null {
  const st = code.toLowerCase();
  if (pathname === '/') return null; // home feed re-scopes in place
  if (pathname.startsWith('/deals')) return `/deals/${st}`;
  if (pathname.startsWith('/brands')) return `/brands?state=${code}`;
  // Precise place → open the finder centered on it; state-only → state hub.
  return place ? dispensariesUrlForPlace(place) : `/dispensaries/${st}`;
}

/**
 * Weedmaps-style location control: the header button opens a modal where the
 * shopper types their address/city/ZIP (Mapbox geocoded) or uses device
 * location — the whole site then personalizes to that place (feed, hubs, map).
 * State quick-picks remain as the fallback when the geocoder is unavailable.
 */
export function MarketSelector({ className }: { className?: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeoPlace[]>([]);
  const [busy, setBusy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const geocodeSeqRef = useRef(0);
  const router = useRouter();
  const pathname = usePathname();

  // Cookies are read after mount so server HTML stays market-agnostic.
  useEffect(() => {
    setSelected(readMarketCookie());
    setLabel(readLabelCookie());
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      // Sequence-check: a slow response for an older query must not overwrite
      // fresher suggestions (or repopulate the list after the modal closed).
      const seq = ++geocodeSeqRef.current;
      void geocodePlaces(query, { limit: 6 }).then((results) => {
        if (seq === geocodeSeqRef.current) setSuggestions(results);
      });
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  function applyPlace(place: GeoPlace | null, stateCode: string) {
    writeMarketCookie(stateCode);
    const display = place
      ? place.city
        ? `${place.city}, ${stateCode}`
        : place.name.split(',').slice(0, 2).join(',').trim()
      : (US_STATES[stateCode] ?? stateCode);
    document.cookie = `${LOCATION_LABEL_COOKIE}=${encodeURIComponent(display)}; max-age=${60 * 60 * 24 * 365}; path=/; samesite=lax`;
    if (place?.city) {
      // Same "city|ST" shape the middleware seeds, so the home feed's
      // city-level scoping picks the chosen place up unchanged.
      document.cookie = `wt_city=${encodeURIComponent(place.city)}|${stateCode}; max-age=${60 * 60 * 24 * 365}; path=/; samesite=lax`;
    } else {
      // No resolvable city (county/address pick, or a state chip): clear the
      // cookie so a PREVIOUS same-state city doesn't keep scoping the feed
      // while the header label claims the new place.
      document.cookie = 'wt_city=; max-age=0; path=/';
    }
    setSelected(stateCode);
    setLabel(display);
    setOpen(false);
    setQuery('');
    setSuggestions([]);
    geocodeSeqRef.current++; // invalidate any in-flight geocode response
    window.dispatchEvent(new CustomEvent(MARKET_CHANGE_EVENT, { detail: stateCode }));
    const dest = destinationFor(pathname ?? '/', stateCode, place);
    if (dest) router.push(dest);
    else router.refresh();
  }

  function choosePlace(place: GeoPlace) {
    if (!place.state || !US_STATES[place.state]) {
      setGeoError('That place is outside our covered states — try a city or ZIP.');
      return;
    }
    applyPlace(place, place.state);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeoError('Location is not available in this browser.');
      return;
    }
    setBusy(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const place = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        setBusy(false);
        if (place?.state && US_STATES[place.state]) applyPlace(place, place.state);
        else setGeoError('Could not resolve your location — try typing your city or ZIP.');
      },
      () => {
        setBusy(false);
        setGeoError('Location permission was denied — type your city or ZIP instead.');
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-border text-muted hover:text-foreground hover:border-border-strong flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
      >
        <MapPin className="text-primary h-4 w-4" />
        <span className="max-w-36 truncate">
          {label ?? (selected ? US_STATES[selected] : 'Set location')}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Set your location"
            className="rounded-card border-border bg-surface shadow-card-hover w-full max-w-md border p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-base font-semibold">
                <MapPin className="text-primary h-4 w-4" /> Where are you shopping?
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="text-muted hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-muted mt-1 text-xs">
              Weedtip shows you the shops, deals, and menus for your area.
            </p>

            <div className="relative mt-3">
              <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setGeoError(null);
                }}
                placeholder="Address, city, or ZIP"
                className="border-border bg-surface-2 h-11 w-full rounded-lg border pl-9 pr-3 text-sm"
                aria-label="Address, city, or ZIP"
              />
            </div>

            {suggestions.length > 0 && (
              <ul className="border-border mt-2 max-h-56 overflow-auto rounded-lg border">
                {suggestions.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => choosePlace(p)}
                      className="hover:bg-surface-2 flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors"
                    >
                      <MapPin className="text-muted h-4 w-4 shrink-0" />
                      <span className="min-w-0 truncate">{p.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={useMyLocation}
              className="text-primary mt-3 inline-flex items-center gap-1.5 text-sm font-medium hover:underline disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
              Use my current location
            </button>
            {geoError && <p className="text-danger mt-2 text-xs">{geoError}</p>}

            <div className="border-border mt-4 border-t pt-3">
              <p className="text-muted mb-2 text-xs font-semibold uppercase tracking-wide">
                Or browse a state
              </p>
              <div className="scrollbar-none flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                {Object.entries(US_STATES).map(([code, name]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => applyPlace(null, code)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                      selected === code
                        ? 'border-primary bg-primary-muted text-primary'
                        : 'border-border text-muted hover:text-foreground',
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
