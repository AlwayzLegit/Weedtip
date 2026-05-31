'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LocateFixed, Loader2, Search } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

/**
 * Location-aware dispensary search. Submits to /dispensaries with the query and,
 * when the user shares it, their geolocation (so results rank by distance).
 *
 * NOTE: free-text location → lat/lng (geocoding) is a follow-up. Today the
 * "Use my location" button uses the browser Geolocation API.
 */
export function SearchBar({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

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
      <div className="relative flex-1">
        <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search dispensaries by name or city"
          className={size === 'lg' ? 'h-12 pl-9 text-base' : 'pl-9'}
          aria-label="Search query"
        />
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
