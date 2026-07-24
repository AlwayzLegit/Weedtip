'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'next-view-transitions';
import { ArrowRight, MapPin } from 'lucide-react';
import type { OperatingHours } from '@weedtip/shared';
import { dealBadge } from '@/lib/format';
import { cardRatingProps, GOOGLE_RATING_COLUMNS } from '@/lib/google-rating';
import { createClient } from '@/lib/supabase/client';
import { US_STATES } from '@/lib/seo';
import { DealCard, type DealCardData } from '../deal-card';
import { DispensaryCard, type DispensaryCardData } from '../dispensary-card';
import { MARKET_CHANGE_EVENT, readCityCookie, readMarketCookie } from '../market-selector';
import { Button } from '../ui/button';
import { ScrollCarousel } from './scroll-carousel';

export type FeedShop = DispensaryCardData;
export type FeedDeal = DealCardData & { id: string };

const SHOP_FIELDS = `slug,name,city,state,cover_image_url,logo_url,is_delivery,is_pickup,is_medical,is_recreational,featured,rating_avg,rating_count,hours,timezone,license_number,${GOOGLE_RATING_COLUMNS}`;

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
  google_rating: number | null;
  google_rating_count: number | null;
  google_rating_at: string | null;
  google_maps_uri: string | null;
  hours: unknown;
  timezone: string | null;
  license_number: string | null;
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
  ...cardRatingProps(r),
  hours: (r.hours ?? null) as OperatingHours | null,
  timezone: r.timezone,
  licensed: !!r.license_number,
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
  const [city, setCity] = useState<string | null>(null);
  const [shops, setShops] = useState<FeedShop[]>(initialShops);
  const [deals, setDeals] = useState<FeedDeal[]>(initialDeals);
  // Tracks which market the current rows belong to ('' = nationwide).
  const [loadedFor, setLoadedFor] = useState('');

  const loadMarket = useCallback(
    async (code: string, cityName: string | null) => {
      const nowIso = new Date().toISOString();
      const [cityRes, shopRes, dealRes] = await Promise.all([
        // City rows lead (Weedmaps scopes to the metro, not the state).
        cityName
          ? supabase
              .from('dispensaries')
              .select(SHOP_FIELDS)
              .eq('status', 'active')
              .eq('state', code)
              .ilike('city', cityName)
              .not('cover_image_url', 'is', null)
              .order('featured', { ascending: false })
              .order('rating_count', { ascending: false })
              .order('rating_avg', { ascending: false })
              .limit(12)
          : Promise.resolve({ data: [] as ShopRow[] }),
        supabase
          .from('dispensaries')
          .select(SHOP_FIELDS)
          .eq('status', 'active')
          .eq('state', code)
          // Photo-backed like the server-rendered rail; the nationwide fill
          // below keeps thin states at a full band.
          .not('cover_image_url', 'is', null)
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

      // City listings lead, state fills, then a thin market's rail fills out
      // with the nationwide set so the band never looks half-stocked.
      const cityShops = ((cityRes.data ?? []) as ShopRow[]).map(toShop);
      const citySlugs = new Set(cityShops.map((s) => s.slug));
      const stateShops = (shopRes.data ?? []).map(toShop).filter((s) => !citySlugs.has(s.slug));
      const scopedShops = [...cityShops, ...stateShops].slice(0, 12);
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
      const detectedCity = readCityCookie(code);
      setMarket(code);
      setCity(detectedCity);
      void loadMarket(code, detectedCity);
    }
  }, [loadMarket]);

  // Header location picker changed while on home → re-scope the feed in place.
  useEffect(() => {
    function onMarketChange(e: Event) {
      const code = (e as CustomEvent<string>).detail;
      if (!code || !US_STATES[code]) return;
      const detectedCity = readCityCookie(code);
      setMarket(code);
      setCity(detectedCity);
      void loadMarket(code, detectedCity);
    }
    window.addEventListener(MARKET_CHANGE_EVENT, onMarketChange);
    return () => window.removeEventListener(MARKET_CHANGE_EVENT, onMarketChange);
  }, [loadMarket]);

  const scoped = market !== null && loadedFor === market;
  const stateName = scoped ? US_STATES[market] : null;
  // "Pasadena, CA" beats "California" when the IP city is known and rows for
  // it actually lead the rail.
  const placeName =
    scoped && city && shops.some((s) => s.city?.toLowerCase() === city.toLowerCase())
      ? `${city}, ${market}`
      : stateName;
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
              {placeName ? `Shopping in ${placeName}` : 'Shopping nationwide'}
            </p>
            <h2 className="text-xl font-semibold sm:text-2xl">
              {placeName ? `Dispensaries in ${placeName}` : 'Dispensaries near you'}
            </h2>
          </div>
          {/* Location changes live in the header's market picker — one
              location control for the session, not a second one per rail. */}
          <Link href={scoped && st ? `/dispensaries?state=${market}` : '/dispensaries'}>
            <Button variant="ghost" size="sm">
              View all <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
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
