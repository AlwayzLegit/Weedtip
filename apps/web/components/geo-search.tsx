'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';
import { geocodePlaces, type GeoPlace } from '@/lib/geocode';
import { cn } from '@/lib/utils';

export type { GeoPlace };

/**
 * Combined finder search box: suggested places (city / zip / address via
 * Mapbox geocoding) fly the map there, and — Google Maps behavior — Enter
 * takes the top suggestion when one is showing. The dropdown's last row runs
 * a dispensary-name text search instead, which is also what Enter falls back
 * to when nothing geocodes. Suggestions are US-only and debounced.
 */
export function GeoSearch({
  initialQuery = '',
  onSubmitQuery,
  onPlace,
  className,
}: {
  initialQuery?: string;
  onSubmitQuery: (query: string) => void;
  onPlace: (place: GeoPlace) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<GeoPlace[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pending, setPending] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const requestId = useRef(0);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const fetchSuggestions = useCallback((q: string) => {
    const id = ++requestId.current;
    void geocodePlaces(q).then((places) => {
      if (id !== requestId.current) return;
      setSuggestions(places);
      setActive(-1);
    });
  }, []);

  const change = (value: string) => {
    setDraft(value);
    setOpen(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fetchSuggestions(value), 300);
  };

  const pick = (place: GeoPlace) => {
    setOpen(false);
    setSuggestions([]);
    setDraft('');
    onPlace(place);
  };

  const submitText = () => {
    setOpen(false);
    onSubmitQuery(draft.trim());
  };

  /**
   * Enter can beat the 300ms debounce + geocoder round trip, leaving zero
   * suggestions for a query like "Pasadena, CA" — which then fell through to a
   * dispensary-NAME search and returned nothing. Google geocodes the raw text
   * on submit, so do the same: one direct geocode, jump to the top place if it
   * resolves, else fall back to the name search.
   */
  const submitRaw = async () => {
    const q = draft.trim();
    if (q.length >= 3) {
      setPending(true);
      try {
        const places = await geocodePlaces(q, { limit: 1 });
        if (places[0]) {
          pick(places[0]);
          return;
        }
      } finally {
        setPending(false);
      }
    }
    submitText();
  };

  // Top suggestion is highlighted by default so Enter commits to it visibly.
  const showList = open && (draft.trim().length >= 3 || suggestions.length > 0);
  const highlighted = active < 0 ? 0 : active;
  const activeId = showList && suggestions.length > 0 ? `geo-opt-${highlighted}` : undefined;

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          // Enter = highlighted suggestion (top by default) > direct geocode
          // of the raw text > name search.
          const chosen = suggestions.length > 0 ? suggestions[highlighted] : undefined;
          if (open && chosen) pick(chosen);
          else void submitRaw();
        }}
      >
        {pending ? (
          <Loader2 className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" />
        ) : (
          <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        )}
        <input
          value={draft}
          onChange={(e) => change(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min((a < 0 ? 0 : a) + 1, suggestions.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max((a < 0 ? 0 : a) - 1, 0));
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder="City, zip, or shop name…"
          aria-label="Search by place or dispensary name"
          role="combobox"
          aria-expanded={showList}
          aria-controls={showList ? 'geo-search-listbox' : undefined}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          className="border-border bg-surface focus:border-primary h-9 w-full rounded-full border pl-9 pr-3 text-base outline-none transition-colors sm:text-sm"
        />
      </form>

      {showList && (
        <div
          id="geo-search-listbox"
          role="listbox"
          className="border-border bg-surface shadow-card-hover absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-xl border py-1 text-sm"
        >
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="option"
              id={`geo-opt-${i}`}
              aria-selected={i === highlighted}
              tabIndex={-1}
              onClick={() => pick(s)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left',
                i === highlighted ? 'bg-surface-2' : 'hover:bg-surface-2',
              )}
            >
              <MapPin className="text-primary h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{s.name}</span>
            </button>
          ))}
          {draft.trim().length >= 3 && (
            <button
              type="button"
              onClick={submitText}
              className="text-muted hover:bg-surface-2 hover:text-foreground flex w-full items-center gap-2 px-3 py-2 text-left"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              Search dispensaries for “{draft.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
