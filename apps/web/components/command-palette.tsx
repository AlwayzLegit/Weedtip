'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  BookOpen,
  Leaf,
  MapPin,
  Package,
  Search,
  Sparkles,
  Store,
  Tag,
  Truck,
} from 'lucide-react';
import { dispensariesUrlForPlace, geocodePlaces, type GeoPlace } from '@/lib/geocode';
import { searchResultHref, type SearchResult } from '@/lib/search';
import { cn } from '@/lib/utils';

const KIND_ICON: Record<string, typeof Store> = {
  dispensary: Store,
  product: Package,
  brand: Award,
  strain: Leaf,
};

// Shown when the palette is open but empty — the fast-lane destinations.
const QUICK_LINKS = [
  { href: '/dispensaries', label: 'Dispensaries', icon: Store },
  { href: '/deliveries', label: 'Deliveries', icon: Truck },
  { href: '/deals', label: 'Deals', icon: Tag },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/brands', label: 'Brands', icon: Award },
  { href: '/strains', label: 'Strains', icon: Leaf },
  { href: '/learn', label: 'Learn', icon: BookOpen },
];

/**
 * ⌘K / Ctrl-K global command palette — the signature "modern app" search. Opens
 * over any page, shows quick destinations when empty, and runs the same
 * locations + entity search as the header typeahead. Fully keyboard-driven and
 * closes on Escape / backdrop click / navigation.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [places, setPlaces] = useState<GeoPlace[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setResults([]);
    setPlaces([]);
    setActive(0);
  }, []);

  // Global hotkey: ⌘K / Ctrl-K toggles; "/" opens when not already typing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // e.key is undefined on some synthetic keydown events (IME composition,
      // browser autofill), which crashed the global listener; bail on those.
      const k = e.key?.toLowerCase();
      if (!k) return;
      if ((e.metaKey || e.ctrlKey) && k === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (
        k === '/' &&
        !open &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target as HTMLElement | null)?.isContentEditable
      ) {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      // Defer focus to after the element mounts.
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      document.body.style.overflow = 'hidden';
      return () => {
        clearTimeout(t);
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  // Debounced search — places + entities in parallel (mirrors GlobalSearch).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setPlaces([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      void geocodePlaces(q, { limit: 3, signal: ctrl.signal }).then((geo) => {
        if (!ctrl.signal.aborted) setPlaces(geo);
      });
      void fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((res) => res.json() as Promise<{ results: SearchResult[] }>)
        .then((json) => {
          if (!ctrl.signal.aborted) setResults(json.results ?? []);
        })
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const hasQuery = query.trim().length >= 2;

  // One flat, ordered action list so arrow keys and Enter share an index space.
  type Action = { key: string; label: string; sublabel?: string; icon: typeof Store; run: () => void };
  const actions = useMemo<Action[]>(() => {
    if (!hasQuery) {
      return QUICK_LINKS.map((l) => ({
        key: l.href,
        label: l.label,
        icon: l.icon,
        run: () => router.push(l.href),
      }));
    }
    const placeActions: Action[] = places.map((p) => ({
      key: `place-${p.id}`,
      label: p.name,
      sublabel: 'Dispensaries on the map',
      icon: MapPin,
      run: () => router.push(dispensariesUrlForPlace(p)),
    }));
    const resultActions: Action[] = results.map((r) => ({
      key: `${r.kind}-${r.id}`,
      label: r.name,
      sublabel: r.subtitle ?? r.kind,
      icon: KIND_ICON[r.kind] ?? Search,
      run: () => router.push(searchResultHref(r)),
    }));
    return [
      ...placeActions,
      ...resultActions,
      {
        key: 'all',
        label: `See all results for “${query.trim()}”`,
        icon: Search,
        run: () => router.push(`/search?q=${encodeURIComponent(query.trim())}`),
      },
    ];
  }, [hasQuery, places, results, query, router]);

  useEffect(() => setActive(0), [query]);

  const runActive = () => {
    const a = actions[active];
    if (a) {
      close();
      a.run();
    }
  };

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, actions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runActive();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  // Keep the highlighted row in view during keyboard nav.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <button
        aria-hidden
        tabIndex={-1}
        onClick={close}
        className="bg-background/70 animate-fade-in absolute inset-0 backdrop-blur-sm"
      />
      <div className="rounded-card border-border bg-surface shadow-card-hover animate-slide-up relative w-full max-w-xl overflow-hidden border">
        <div className="border-border flex items-center gap-3 border-b px-4">
          <Search className="text-muted h-4 w-4 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search dispensaries, products, brands, strains…"
            aria-label="Search Weedtip"
            className="h-14 w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
          <kbd className="border-border text-muted hidden shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium sm:block">
            ESC
          </kbd>
        </div>

        <ul ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {!hasQuery && (
            <li className="text-muted flex items-center gap-1.5 px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide">
              <Sparkles className="h-3 w-3" /> Jump to
            </li>
          )}
          {actions.map((a, i) => (
            <li key={a.key}>
              <button
                type="button"
                data-active={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={runActive}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                  i === active ? 'bg-surface-2' : 'hover:bg-surface-2',
                )}
              >
                <span className="bg-primary-muted text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                  <a.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{a.label}</span>
                  {a.sublabel && (
                    <span className="text-muted block truncate text-xs capitalize">{a.sublabel}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
          {hasQuery && actions.length === 1 && (
            <li className="text-muted px-3 py-4 text-center text-sm">Searching…</li>
          )}
        </ul>
      </div>
    </div>
  );
}
