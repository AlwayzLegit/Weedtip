'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LocateFixed, Loader2, MapPin, Search } from 'lucide-react';
import { dispensariesUrlForPlace, geocodePlaces, type GeoPlace } from '@/lib/geocode';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';

/**
 * Location-aware dispensary search (homepage hero band). Typing suggests real
 * places (city / zip / address via Mapbox geocoding); picking one — or just
 * hitting Enter, which takes the top suggestion like Google Maps — opens the
 * interactive map centered there. Text that doesn't geocode falls back to a
 * dispensary-name search, and "Use my location" ranks results by distance.
 */
export function SearchBar({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeoPlace[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const requestId = useRef(0);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function change(value: string) {
    setQuery(value);
    setOpen(true);
    clearTimeout(timer.current);
    const id = ++requestId.current;
    timer.current = setTimeout(() => {
      void geocodePlaces(value).then((places) => {
        if (id !== requestId.current) return;
        setSuggestions(places);
        setActive(-1);
      });
    }, 300);
  }

  function goToPlace(place: GeoPlace) {
    setOpen(false);
    router.push(dispensariesUrlForPlace(place));
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Enter = highlighted suggestion > top suggestion > name/near-me search.
    const chosen = active >= 0 ? suggestions[active] : suggestions[0];
    if (open && chosen && query.trim()) {
      goToPlace(chosen);
      return;
    }
    setOpen(false);
    const params = new URLSearchParams();
    if (query.trim()) params.set('query', query.trim());
    if (coords) {
      params.set('lat', String(coords.lat));
      params.set('lng', String(coords.lng));
    }
    router.push(`/dispensaries?${params.toString()}`);
  }

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-2 sm:flex-row" role="search">
      <div ref={rootRef} className="relative flex-1">
        <Search className="text-muted pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2" />
        <Input
          value={query}
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
          placeholder="City, ZIP, address, or dispensary"
          className={size === 'lg' ? 'h-12 pl-9 text-base' : 'pl-9'}
          aria-label="Search by place or dispensary name"
        />

        {open && suggestions.length > 0 && (
          <div className="border-border bg-surface shadow-card-hover absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border py-1 text-left text-sm">
            {suggestions.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goToPlace(s)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left',
                  active === i ? 'bg-surface-2' : 'hover:bg-surface-2',
                )}
              >
                <MapPin className="text-primary h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{s.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <Button
        type="button"
        variant={coords ? 'primary' : 'outline'}
        size={size === 'lg' ? 'lg' : 'md'}
        onClick={useMyLocation}
        disabled={locating}
      >
        {locating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LocateFixed className="h-4 w-4" />
        )}
        {coords ? 'Located' : 'Use my location'}
      </Button>
      <Button type="submit" size={size === 'lg' ? 'lg' : 'md'}>
        Search
      </Button>
    </form>
  );
}
