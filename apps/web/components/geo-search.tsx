'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BBox } from '@/lib/us-state-bounds';

export interface GeoPlace {
  name: string;
  center: { lat: number; lng: number };
  bbox: BBox | null;
}

type Suggestion = { id: string; place_name: string; center: [number, number]; bbox?: number[] };

/**
 * Combined finder search box: type a shop name and press Enter to full-text
 * search, or pick a suggested place (city / zip / address via Mapbox
 * geocoding) to fly the map there. Suggestions are US-only and debounced.
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
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [draft, setDraft] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
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

  const fetchSuggestions = useCallback(
    (q: string) => {
      if (!token || q.trim().length < 3) {
        setSuggestions([]);
        return;
      }
      const id = ++requestId.current;
      const url =
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q.trim())}.json` +
        `?access_token=${token}&country=us&limit=5&types=region,postcode,district,place,locality,neighborhood,address`;
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { features?: Suggestion[] } | null) => {
          if (id !== requestId.current) return;
          setSuggestions(j?.features ?? []);
          setActive(-1);
        })
        .catch(() => {});
    },
    [token],
  );

  const change = (value: string) => {
    setDraft(value);
    setOpen(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fetchSuggestions(value), 300);
  };

  const pick = (s: Suggestion) => {
    setOpen(false);
    setSuggestions([]);
    setDraft('');
    onPlace({
      name: s.place_name,
      center: { lat: s.center[1], lng: s.center[0] },
      bbox:
        s.bbox && s.bbox.length === 4
          ? [s.bbox[0]!, s.bbox[1]!, s.bbox[2]!, s.bbox[3]!]
          : null,
    });
  };

  const submit = () => {
    setOpen(false);
    onSubmitQuery(draft.trim());
  };

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (active >= 0 && suggestions[active]) pick(suggestions[active]);
          else submit();
        }}
      >
        <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <input
          value={draft}
          onChange={(e) => change(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, suggestions.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, -1));
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder="City, zip, or shop name…"
          aria-label="Search by place or dispensary name"
          className="border-border bg-surface focus:border-primary h-9 w-full rounded-full border pl-9 pr-3 text-sm outline-none transition-colors"
        />
      </form>

      {open && (draft.trim().length >= 3 || suggestions.length > 0) && (
        <div className="border-border bg-surface shadow-card-hover absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-xl border py-1 text-sm">
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => pick(s)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left',
                active === i ? 'bg-surface-2' : 'hover:bg-surface-2',
              )}
            >
              <MapPin className="text-primary h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{s.place_name}</span>
            </button>
          ))}
          {draft.trim().length >= 3 && (
            <button
              type="button"
              onClick={submit}
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
