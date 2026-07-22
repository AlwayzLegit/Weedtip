'use client';

import { useEffect, useRef, useState } from 'react';
import { HeroCarousel, type HeroSlide } from './hero-carousel';
import { MARKET_CHANGE_EVENT, readCityCookie, readMarketCookie } from '@/components/market-selector';

/**
 * Region-aware wrapper around the hero carousel. The homepage is statically
 * cached, so it SSRs the nationwide hero; after mount this reads the visitor's
 * chosen market (wt_state + optional wt_city) and swaps in that region's sold
 * carousel when it has one. Re-runs on MARKET_CHANGE_EVENT so switching markets
 * updates the hero in place. Falls back to the nationwide slides otherwise.
 */
export function RegionalHero({ initialSlides }: { initialSlides: HeroSlide[] }) {
  const [slides, setSlides] = useState<HeroSlide[]>(initialSlides);
  const seqRef = useRef(0);

  useEffect(() => {
    function load() {
      const state = readMarketCookie();
      if (!state) {
        setSlides(initialSlides);
        return;
      }
      const city = readCityCookie(state);
      const qs = new URLSearchParams({ state });
      if (city) qs.set('city', city);
      const seq = ++seqRef.current;
      fetch(`/api/hero?${qs.toString()}`)
        .then((r) => (r.ok ? r.json() : { slides: [] }))
        .then((j: { slides?: HeroSlide[] }) => {
          // Ignore a stale response if the market changed again mid-flight.
          if (seq !== seqRef.current) return;
          setSlides(j.slides?.length ? j.slides : initialSlides);
        })
        .catch(() => {
          if (seq === seqRef.current) setSlides(initialSlides);
        });
    }
    load();
    window.addEventListener(MARKET_CHANGE_EVENT, load);
    return () => window.removeEventListener(MARKET_CHANGE_EVENT, load);
  }, [initialSlides]);

  if (slides.length === 0) return null;
  return <HeroCarousel slides={slides} />;
}
