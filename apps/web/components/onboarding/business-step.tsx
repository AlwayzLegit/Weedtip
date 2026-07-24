'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Search, Store } from 'lucide-react';
import type { BusinessHit } from '@/app/api/owner/business-search/route';
import { chooseBusiness, chooseCreateNew } from '@/app/get-started/actions';
import { LogoImage } from '../logo-image';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

/**
 * Step 2: find your own shop in the directory.
 *
 * This step exists because the old flow sent owners to the public directory and
 * expected them to navigate back to their own listing page and scroll past the
 * whole consumer experience to reach a claim box. Searching here — and saying
 * up front which results are already claimed or aren't verifiable yet — turns
 * the most confusing part of the funnel into one input.
 */
export function BusinessStep({ initialQuery }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery ?? '');
  const [hits, setHits] = useState<BusinessHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits(null);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    const mine = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      void fetch(`/api/owner/business-search?q=${encodeURIComponent(term)}`, {
        signal: ctrl.signal,
      })
        .then((r) => r.json())
        .then((d: { results: BusinessHit[] }) => {
          // Ignore a slow response that lost the race to a newer keystroke.
          if (mine === seq.current) setHits(d.results ?? []);
        })
        .catch(() => {
          if (mine === seq.current) setHits([]);
        })
        .finally(() => {
          if (mine === seq.current) setLoading(false);
        });
    }, 220);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by shop name or city…"
          className="pl-9"
          autoFocus
          aria-label="Search for your dispensary"
        />
        {loading && (
          <Loader2 className="text-muted absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" />
        )}
      </div>

      {hits && hits.length > 0 && (
        <ul className="space-y-2">
          {hits.map((h) => (
            <li key={h.slug}>
              <form action={chooseBusiness}>
                <input type="hidden" name="slug" value={h.slug} />
                <button
                  type="submit"
                  disabled={h.claimed}
                  className="rounded-card border-border bg-surface enabled:hover:border-primary/60 enabled:hover:bg-surface-2 focus-visible:ring-primary group flex w-full items-center gap-3 border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60"
                >
                  <LogoImage src={h.logoUrl} name={h.name} className="h-10 w-10 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{h.name}</span>
                    <span className="text-muted flex items-center gap-1 truncate text-xs">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                      {h.address ? `${h.address}, ` : ''}
                      {h.city ? `${h.city}, ` : ''}
                      {h.state}
                    </span>
                  </span>
                  {h.claimed ? (
                    <span className="text-muted shrink-0 text-xs font-medium">Already claimed</span>
                  ) : h.claimable ? (
                    <span className="text-primary shrink-0 text-xs font-semibold">
                      Claim this →
                    </span>
                  ) : (
                    <span className="text-muted shrink-0 text-right text-xs">
                      No license on file
                      <span className="block text-[11px]">we&apos;ll verify manually</span>
                    </span>
                  )}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {hits && hits.length === 0 && !loading && (
        <p className="text-muted rounded-card border-border border border-dashed p-6 text-center text-sm">
          Nothing matching &ldquo;{q.trim()}&rdquo;. Try just the shop name, or the city.
        </p>
      )}

      <div className="rounded-card border-border bg-surface-2 flex flex-wrap items-center justify-between gap-3 border p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">Can&apos;t find your shop?</p>
          <p className="text-muted mt-0.5 text-sm">
            Newly licensed, or never imported? Add it yourself — it goes live after a quick review.
          </p>
        </div>
        <form action={chooseCreateNew}>
          <Button type="submit" variant="outline" size="sm">
            <Store className="h-4 w-4" /> Add my business
          </Button>
        </form>
      </div>
    </div>
  );
}
