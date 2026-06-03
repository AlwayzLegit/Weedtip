import { type NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Typeahead endpoint: a few results per entity kind for the global search box. */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'search';
  if (!(await rateLimit('search', { limit: 60, window: '60 s' }, ip)).success) {
    return NextResponse.json({ results: [] }, { status: 429 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('search_global', {
    search_query: q,
    per_kind_limit: 5,
  });
  if (error) return NextResponse.json({ results: [] });
  return NextResponse.json({ results: data ?? [] });
}
