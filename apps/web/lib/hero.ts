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
  const args = { p_state: state ?? undefined, p_city: city ?? undefined };
  // Hero now sells on the region ad-slot system; region fills lead, and the
  // legacy placements-based hero serves as a fallback during the transition.
  const [region, legacy] = await Promise.all([
    supabase.rpc('get_region_hero', args),
    supabase.rpc('get_hero_placements', args),
  ]);
  const rows = [
    ...((region.data ?? []) as unknown as HeroRow[]),
    ...((legacy.data ?? []) as unknown as HeroRow[]),
  ];
  // Most specific first (state > nationwide); region fills win ties (listed
  // first). De-dupe by slug so a shop sold on both systems shows once. Cap 8.
  rows.sort((a, b) => b.specificity - a.specificity);
  const seen = new Set<string>();
  const merged: HeroRow[] = [];
  for (const r of rows) {
    if (!r.slug || seen.has(r.slug)) continue;
    seen.add(r.slug);
    merged.push(r);
  }
  return merged.slice(0, 8);
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
