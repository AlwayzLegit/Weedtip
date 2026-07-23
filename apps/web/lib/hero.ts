import 'server-only';
import type { HeroSlide } from '@/components/home/hero-carousel';
import { createStaticClient } from '@/lib/supabase/static';

interface HeroRow {
  placement_id: string;
  kind: string;
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  cover_url: string | null;
  logo_url: string | null;
  headline: string | null;
  rating: number | null;
  review_count: number | null;
  specificity: number;
}

function toSlide(r: HeroRow): HeroSlide {
  return {
    placementId: r.placement_id,
    kind: r.kind === 'brand' ? 'brand' : 'dispensary',
    slug: r.slug,
    name: r.name,
    city: r.city,
    state: r.state,
    coverUrl: r.cover_url,
    logoUrl: r.logo_url,
    headline: r.headline,
    rating: r.rating,
    reviewCount: r.review_count ?? 0,
  };
}

async function fetchHero(state: string | null, city: string | null): Promise<HeroRow[]> {
  const supabase = createStaticClient();
  // Hero sells entirely on the region ad-slot system now (get_region_hero already
  // orders by specificity + slot position and caps at 8). De-dupe by slug defensively.
  const { data } = await supabase.rpc('get_region_hero', {
    p_state: state ?? undefined,
    p_city: city ?? undefined,
  });
  const seen = new Set<string>();
  const rows: HeroRow[] = [];
  for (const r of (data ?? []) as unknown as HeroRow[]) {
    if (!r.slug || seen.has(r.slug)) continue;
    seen.add(r.slug);
    rows.push(r);
  }
  return rows;
}

/**
 * Nationwide (unscoped) hero slides — the static, SSR default shown before the
 * client resolves the visitor's market. Dispensaries + brands.
 */
export async function fetchNationwideHeroSlides(): Promise<HeroSlide[]> {
  return (await fetchHero(null, null)).map(toSlide);
}

/**
 * Region-specific hero slides for a visitor's market (state + optional city).
 * Only returns slides actually scoped to that state/city (specificity ≥ 2), so
 * the client swaps the SSR nationwide hero only when a market has its own sold
 * carousel — otherwise the homepage keeps the nationwide slides.
 */
export async function fetchRegionalHeroSlides(
  state: string,
  city: string | null,
): Promise<HeroSlide[]> {
  const rows = await fetchHero(state, city);
  return rows.filter((r) => r.specificity >= 2).map(toSlide);
}
