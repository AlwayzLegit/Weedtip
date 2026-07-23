'use client';

import { useMemo, useState } from 'react';
import { Link } from 'next-view-transitions';
import { BadgeCheck, Loader2, MapPin, Search, Truck } from 'lucide-react';
import { deliveriesServingCounty } from '@weedtip/supabase/queries';
import { track } from '@/lib/analytics';
import { formatPrice } from '@/lib/format';
import { geocodePlaces } from '@/lib/geocode';
import { createClient } from '@/lib/supabase/client';
import { Badge } from './ui/badge';
import { MediaImage } from './media-image';
import { RatingStars } from './rating-stars';

type ServingShop = {
  id: string;
  slug: string;
  name: string;
  county: string | null;
  state: string;
  cover_image_url: string | null;
  logo_url: string | null;
  is_medical: boolean;
  is_recreational: boolean;
  rating_avg: number;
  rating_count: number;
  licensed: boolean;
  featured: boolean;
  delivery_minimum_cents: number | null;
  delivery_fee_cents: number | null;
  delivery_eta_minutes: number | null;
};

type Result =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'no_place' }
  | { kind: 'no_county' }
  | { kind: 'ok'; county: string; state: string; shops: ServingShop[] };

/** "$45 min · $5 fee · ~45 min · as listed by shop" — omitted when nothing's set. */
function deliveryTerms(s: ServingShop): string | null {
  const parts: string[] = [];
  if (s.delivery_minimum_cents != null) parts.push(`${formatPrice(s.delivery_minimum_cents)} min`);
  if (s.delivery_fee_cents != null)
    parts.push(
      s.delivery_fee_cents === 0 ? 'Free delivery' : `${formatPrice(s.delivery_fee_cents)} fee`,
    );
  if (s.delivery_eta_minutes != null) parts.push(`~${s.delivery_eta_minutes} min`);
  return parts.length ? `${parts.join(' · ')} · as listed by shop` : null;
}

/**
 * T7 — "Who delivers to my address?" Delivery-only listings publish only a
 * service-area county (the DCC withholds a mapped premise), so an address/zip
 * is geocoded to its county and matched against the delivery services that list
 * it. Purely informational — Weedtip is a directory, never a checkout.
 */
export function DeliverToInput({ className }: { className?: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [draft, setDraft] = useState('');
  const [result, setResult] = useState<Result>({ kind: 'idle' });

  async function check(e: React.FormEvent) {
    e.preventDefault();
    const q = draft.trim();
    if (q.length < 3) return;
    setResult({ kind: 'loading' });
    const places = await geocodePlaces(q, { limit: 1 });
    const place = places[0];
    if (!place) {
      setResult({ kind: 'no_place' });
      return;
    }
    if (!place.county || !place.state) {
      setResult({ kind: 'no_county' });
      return;
    }
    const { data } = await deliveriesServingCounty(supabase, {
      state: place.state,
      county: place.county,
    });
    const shops = (data ?? []) as ServingShop[];
    track('delivery_coverage_checked', {
      county: place.county,
      state: place.state,
      results: shops.length,
    });
    setResult({ kind: 'ok', county: place.county, state: place.state, shops });
  }

  return (
    <section className={className}>
      <div className="border-border bg-surface rounded-card border p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="bg-primary-muted text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <Truck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold leading-tight">Who delivers to your address?</h2>
            <p className="text-muted mt-0.5 text-sm">
              Enter your address or ZIP to see the licensed services that deliver to your county.
            </p>
          </div>
        </div>

        <form onSubmit={check} className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <MapPin className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Street address or ZIP…"
              aria-label="Your address or ZIP"
              autoComplete="postal-code"
              className="border-border bg-background focus:border-primary h-10 w-full rounded-full border pl-9 pr-3 text-sm outline-none transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={result.kind === 'loading' || draft.trim().length < 3}
            className="bg-primary text-primary-foreground inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-opacity disabled:opacity-50"
          >
            {result.kind === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Check
          </button>
        </form>

        {result.kind === 'no_place' && (
          <p className="text-muted mt-3 text-sm">
            We couldn&apos;t find that address. Try a full street address or ZIP code.
          </p>
        )}
        {result.kind === 'no_county' && (
          <p className="text-muted mt-3 text-sm">
            Enter a more specific address or ZIP so we can match your county.
          </p>
        )}

        {result.kind === 'ok' && (
          <div className="mt-4">
            {result.shops.length === 0 ? (
              <p className="text-muted text-sm">
                No delivery services list{' '}
                <strong>
                  {result.county} County, {result.state}
                </strong>{' '}
                yet. New listings are added regularly — check back soon.
              </p>
            ) : (
              <>
                <p className="mb-3 text-sm font-medium">
                  {result.shops.length}{' '}
                  {result.shops.length === 1 ? 'service delivers' : 'services deliver'} to{' '}
                  <span className="text-primary">
                    {result.county} County, {result.state}
                  </span>
                </p>
                <ul className="divide-border border-border divide-y border-y">
                  {result.shops.map((s) => {
                    const terms = deliveryTerms(s);
                    return (
                      <li key={s.id}>
                        <Link
                          href={`/dispensary/${s.slug}`}
                          prefetch={false}
                          className="hover:bg-surface-2 group flex items-center gap-3 py-2.5 transition-colors"
                        >
                          <MediaImage
                            url={s.cover_image_url}
                            alt={s.name}
                            fallbackUrl={s.logo_url}
                            className="h-12 w-12 shrink-0 rounded-lg"
                            iconClassName="h-5 w-5"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="group-hover:text-primary truncate text-sm font-semibold">
                                {s.name}
                              </span>
                              {s.featured && <Badge tone="primary">Sponsored</Badge>}
                            </div>
                            <div className="mt-0.5 flex min-h-[16px] items-center gap-1.5 text-xs">
                              {s.rating_avg > 0 ? (
                                <>
                                  <RatingStars rating={s.rating_avg} size={12} />
                                  <span className="text-muted">
                                    {s.rating_avg.toFixed(1)}
                                    {s.rating_count ? ` (${s.rating_count})` : ''}
                                  </span>
                                </>
                              ) : s.licensed ? (
                                <span className="text-primary inline-flex items-center gap-1 font-medium">
                                  <BadgeCheck className="h-3 w-3" /> Licensed
                                </span>
                              ) : (
                                <span className="text-muted">New listing</span>
                              )}
                            </div>
                            {terms && <p className="text-muted mt-0.5 truncate text-xs">{terms}</p>}
                          </div>
                          <span className="text-primary inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
                            <BadgeCheck className="h-4 w-4" />
                            <span className="hidden sm:inline">Delivers to you</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-muted mt-3 text-xs">
                  Coverage is the service area each shop lists with the state. Confirm delivery to
                  your exact address with the shop — a valid 21+ ID is required at handoff.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
