import { type NextRequest, NextResponse } from 'next/server';
import { searchDispensaries } from '@weedtip/supabase/queries';
import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export type BusinessHit = {
  slug: string;
  name: string;
  city: string | null;
  state: string;
  address: string | null;
  logoUrl: string | null;
  /** Already has an owner — someone claimed it, so this one isn't available. */
  claimed: boolean;
  /**
   * Claims are verified against the state license on file, so a listing without
   * one can't be claimed yet. The picker says so up front instead of letting
   * the owner fill in a whole form and fail on submit.
   */
  claimable: boolean;
};

/**
 * Typeahead for the owner onboarding wizard: find YOUR shop in the directory.
 *
 * Deliberately public (no auth) — picking your business happens before the
 * account exists, which is what lets the wizard collect intent before asking
 * anyone to sign up. Everything returned is already on the public listing page.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'business-search';
  if (!(await rateLimit('business-search', { limit: 60, window: '60 s' }, ip)).success) {
    return NextResponse.json({ results: [] }, { status: 429 });
  }

  const supabase = await createClient();
  const { data, error } = await searchDispensaries(supabase, {
    query: q,
    page: 0,
    page_size: 8,
    radius_meters: 40000,
  });
  if (error) return NextResponse.json({ results: [] });

  const results: BusinessHit[] = (data ?? []).map((d) => ({
    slug: d.slug,
    name: d.name,
    city: d.city,
    state: d.state,
    address: d.address,
    logoUrl: d.logo_url,
    claimed: !!d.owner_id,
    claimable: !!d.license_number,
  }));
  return NextResponse.json({ results });
}
