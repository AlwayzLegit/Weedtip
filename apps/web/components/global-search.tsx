'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Award, Leaf, Package, Search, Store } from 'lucide-react';
import { searchResultHref, type SearchResult } from '@/lib/search';
import { cn } from '@/lib/utils';

const KIND_ICON: Record<string, typeof Store> = {
  dispensary: Store,
  product: Package,
  brand: Award,
  strain: Leaf,
};

/** Persistent global typeahead: stores, products, brands, strains. */
export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  // Debounced typeahead fetch (min 2 chars).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const json = (await res.json()) as { results: SearchResult[] };
        setResults(json.results ?? []);
        setActive(-1);
      } catch {
        /* aborted or offline — ignore */
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function goToResults() {
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const sel = results[active];
      if (sel) {
        setOpen(false);
        router.push(searchResultHref(sel));
      } else {
        goToResults();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search stores, products, brands, strains…"
          aria-label="Search Weedtip"
          className="border-border bg-surface focus-visible:ring-primary/40 focus-visible:border-primary/60 h-10 w-full rounded-full border pl-9 pr-4 text-sm outline-none transition-colors focus-visible:ring-2"
        />
      </div>

      {showDropdown && (
        <div className="border-border bg-surface shadow-card-hover absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-2xl border">
          {results.length === 0 ? (
            <p className="text-muted px-4 py-6 text-center text-sm">No matches yet — keep typing.</p>
          ) : (
            <ul className="max-h-[70vh] overflow-y-auto py-1">
              {results.map((r, i) => {
                const Icon = KIND_ICON[r.kind] ?? Search;
                return (
                  <li key={`${r.kind}-${r.id}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => {
                        setOpen(false);
                        router.push(searchResultHref(r));
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2 text-left',
                        i === active ? 'bg-surface-2' : 'hover:bg-surface-2',
                      )}
                    >
                      {r.image_url ? (
                        <img
                          src={r.image_url}
                          alt=""
                          className="bg-surface-2 border-border h-9 w-9 shrink-0 rounded-lg border object-cover"
                        />
                      ) : (
                        <span className="bg-primary-muted text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                          <Icon className="h-4 w-4" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.name}</span>
                        {r.subtitle && (
                          <span className="text-muted block truncate text-xs">{r.subtitle}</span>
                        )}
                      </span>
                      <span className="text-muted text-[10px] uppercase tracking-wide">{r.kind}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <button
            type="button"
            onClick={goToResults}
            className="border-border text-primary hover:bg-surface-2 block w-full border-t px-4 py-2.5 text-left text-sm font-medium"
          >
            See all results for “{query.trim()}” →
          </button>
        </div>
      )}
    </div>
  );
}
