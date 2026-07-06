'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';
import type { OperatingHours } from '@weedtip/shared';
import { dealBadge } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { US_STATES } from '@/lib/seo';
import { DealCard, type DealCardData } from '../deal-card';
import { DispensaryCard, type DispensaryCardData } from '../dispensary-card';
import { readMarketCookie, writeMarketCookie } from '../market-selector';
import { Button } from '../ui/button';
import { ScrollCarousel } from './scroll-carousel';

export type FeedShop = DispensaryCardData;
export type FeedDeal = DealCardData & { id: string };

const SHOP_FIELDS =
  'slug,name,city,state,cover_image_url,logo_url,is_delivery,is_pickup,is_medical,is_recreational,featured,rating_avg,rating_count,hours,timezone';

type ShopRow = {
  slug: string;
  name: string;
  city: string | null;
  state: string;
  cover_image_url: string | null;
  logo_url: string | null;
  is_delivery: boolean;
  is_pickup: boolean;
  is_medical: boolean;
  is_recreational: boolean;
  featured: boolean;
  rating_avg: number;
  rating_count: number;
  hours: unknown;
  timezone: string | null;
};

const toShop = (r: ShopRow): FeedShop => ({
  slug: r.slug,
  name: r.name,
  city: r.city,
  state: r.state,
  coverImageUrl: r.cover_image_url,
  logoUrl: r.logo_url,
  isDelivery: r.is_delivery,
  isPickup: r.is_pickup,
  isMedical: r.is_medical,
  isRecreational: r.is_recreational,
  featured: r.featured,
  rating: r.rating_avg,
  reviewCount: r.rating_count,
  hours: (r.hours ?? null) as OperatingHours | null,
  timezone: r.timezone,
});

/**
 * Location-aware merchandising block (Weedmaps' "Shopping in {State}"):
 * server renders nationwide rows so the page stays ISR-cached; after
 * hydration this reads the wt_state market cookie and swaps in state-scoped
 * dispensaries + deals fetched with the anon browser client. The inline
 * state picker writes the same cookie the navbar selector uses.
 */
export function MarketFeed({
  initialShops,
  initialDeals,
  children,
}: {
  initialShops: FeedShop[];
  initialDeals: FeedDeal[];
  /** Rendered between the shops and deals rails (Weedmaps order:
      dispensaries near you → deliveries → deals). */
  children?: React.ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [market, setMarket] = useState<string | null>(null);
  const [shops, setShops] = useState<FeedShop[]>(initialShops);
  const [deals, setDeals] = useState<FeedDeal[]>(initialDeals);
  // Tracks which market the current rows belong to ('' = nationwide).
  const [loadedFor, setLoadedFor] = useState('');

  const loadMarket = useCallback(
    async (code: string) => {
      const nowIso = new Date().toISOString();
      const [shopRes, dealRes] = await Promise.all([
        supabase
          .from('dispensaries')
          .select(SHOP_FIELDS)
          .eq('status', 'active')
          .eq('state', code)
          .order('featured', { ascending: false })
          .order('rating_count', { ascending: false })
          .order('rating_avg', { ascending: false })
          .limit(12),
        supabase
          .from('deals')
          .select(
            'id,title,description,code,discount_type,discount_value,dispensary:dispensaries!inner(slug,name,city,state,status)',
          )
          .eq('is_active', true)
          .lte('start_date', nowIso)
          .gte('end_date', nowIso)
          .eq('dispensary.status', 'active')
          .eq('dispensary.state', code)
          .order('end_date')
          .limit(12),
      ]);

      const scopedShops = (shopRes.data ?? []).map(toShop);
      // State listings lead, but a thin market's rail fills out with the
      // nationwide set so the band never looks half-stocked.
      const scopedSlugs = new Set(scopedShops.map((s) => s.slug));
      setShops(
        scopedShops.length >= 4
          ? scopedShops
          : [...scopedShops, ...initialShops.filter((s) => !scopedSlugs.has(s.slug))].slice(0, 12),
      );
      setDeals(
        (dealRes.data ?? []).flatMap((d) => {
          const disp = d.dispensary as unknown as {
            slug: string;
            name: string;
            city: string | null;
            state: string;
          } | null;
          if (!disp) return [];
          return [
            {
              id: d.id,
              title: d.title,
              description: d.description,
              code: d.code,
              discountType: d.discount_type,
              discountValue: d.discount_value,
              dispensarySlug: disp.slug,
              dispensaryName: disp.name,
              city: disp.city ?? '',
              state: disp.state,
            },
          ];
        }),
      );
      setLoadedFor(code);
    },
    [supabase, initialShops],
  );

  useEffect(() => {
    const code = readMarketCookie();
    if (code) {
      setMarket(code);
      void loadMarket(code);
    }
  }, [loadMarket]);

  const choose = (code: string) => {
    if (!code) return;
    writeMarketCookie(code);
    setMarket(code);
    void loadMarket(code);
  };

  const scoped = market !== null && loadedFor === market;
  const stateName = scoped ? US_STATES[market] : null;
  const st = market?.toLowerCase();

  // Card-family deal badge: a shop's soonest-ending live deal, e.g. "20% off".
  const dealBadgeBySlug = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of deals) {
      if (!m.has(d.dispensarySlug)) {
        m.set(d.dispensarySlug, dealBadge(d.discountType, d.discountValue));
      }
    }
    return m;
  }, [deals]);

  return (
    <div className="space-y-16">
      {/* Featured dispensaries near you */}
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow mb-1 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {stateName ? `Shopping in ${stateName}` : 'Shopping nationwide'}
            </p>
            <h2 className="text-xl font-semibold sm:text-2xl">
              {stateName ? `Dispensaries in ${stateName}` : 'Dispensaries near you'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={market ?? ''}
              onChange={(e) => choose(e.target.value)}
              aria-label="Choose your state"
              className="border-border bg-surface h-9 rounded-full border px-3 text-sm"
            >
              <option value="" disabled>
                Change state…
              </option>
              {Object.entries(US_STATES).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
            <Link href={scoped && st ? `/dispensaries?state=${market}` : '/dispensaries'}>
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
        {shops.length > 0 ? (
          <ScrollCarousel itemClassName="w-72" ariaLabel="Featured dispensaries">
            {shops.map((s) => (
              <DispensaryCard
                key={s.slug}
                d={{ ...s, dealBadge: dealBadgeBySlug.get(s.slug) ?? null }}
              />
            ))}
          </ScrollCarousel>
        ) : (
          <p className="text-muted">No dispensaries yet. Check back soon.</p>
        )}
      </section>

      {children}

      {/* Deals near you */}
      {deals.length > 0 && (
        <section>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-1">Save today</p>
              <h2 className="text-xl font-semibold sm:text-2xl">
                {stateName ? `Deals in ${stateName}` : 'Deals near you'}
              </h2>
            </div>
            <Link href={scoped && st ? `/deals/${st}` : '/deals'} className="shrink-0">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <ScrollCarousel itemClassName="w-80" ariaLabel="Deals near you">
            {deals.map((d) => (
              <DealCard key={d.id} deal={d} />
            ))}
          </ScrollCarousel>
        </section>
      )}
    </div>
  );
}
