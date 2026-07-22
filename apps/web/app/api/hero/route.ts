import { NextResponse } from 'next/server';
import { fetchRegionalHeroSlides } from '@/lib/hero';

/**
 * Region-specific hero slides for the homepage carousel. The page SSRs the
 * nationwide hero; the client calls this with its resolved market (state +
 * optional city) and swaps in the regional slides when that market has its own
 * sold carousel. Returns only region-scoped slides — an empty list means "keep
 * the nationwide hero".
 */
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const state = (searchParams.get('state') ?? '').trim().toUpperCase();
  const city = (searchParams.get('city') ?? '').trim() || null;
  if (!/^[A-Z]{2}$/.test(state)) {
    return NextResponse.json({ slides: [] });
  }

  const slides = await fetchRegionalHeroSlides(state, city);
  return NextResponse.json(
    { slides },
    {
      headers: {
        // Region hero changes rarely; cache per (state,city) at the edge.
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
      },
    },
  );
}
