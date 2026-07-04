'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '../ui/input';

type Hit = { id: string; name: string; city: string | null; state: string };

/**
 * Admin typeahead that searches all dispensaries server-side. Submits the chosen
 * dispensary's UUID under `name` (default `dispensary_id`) via a hidden input, so
 * it drops into the existing promotions forms without touching their actions.
 */
export function DispensaryPicker({ name = 'dispensary_id' }: { name?: string }) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [selected, setSelected] = useState<Hit | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected || query.trim().length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/dispensary-search?q=${encodeURIComponent(query.trim())}`,
          { signal: ctrl.signal },
        );
        const json = (await res.json()) as { results: Hit[] };
        setHits(json.results ?? []);
        setOpen(true);
      } catch {
        // aborted or network error — leave the current list
      }
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query, selected]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center gap-2">
        <input type="hidden" name={name} value={selected.id} />
        <span className="border-border bg-surface-2 flex flex-1 items-center justify-between rounded-lg border px-3 py-2 text-sm">
          <span className="truncate">
            {selected.name}
            {selected.city ? (
              <span className="text-muted"> · {selected.city}, {selected.state}</span>
            ) : (
              <span className="text-muted"> · {selected.state}</span>
            )}
          </span>
          <button
            type="button"
            aria-label="Clear selection"
            className="text-muted hover:text-foreground ml-2 shrink-0"
            onClick={() => {
              setSelected(null);
              setQuery('');
              setHits([]);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </span>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      {/* Empty until a hit is chosen; the server action rejects a blank ID. */}
      <input type="hidden" name={name} value="" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => hits.length > 0 && setOpen(true)}
        placeholder="Search dispensary by name or city…"
        autoComplete="off"
      />
      {open && hits.length > 0 && (
        <ul className="border-border bg-surface shadow-card absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border py-1 text-sm">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="hover:bg-surface-2 flex w-full flex-col items-start px-3 py-2 text-left"
                onClick={() => {
                  setSelected(h);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{h.name}</span>
                <span className="text-muted text-xs">
                  {h.city ? `${h.city}, ${h.state}` : h.state}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
