import { type NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Admin typeahead for the promotions pickers — searches all 9,433 dispensaries
 * by name or city instead of the old first-1,000-alphabetical <select>. Admin
 * only; RLS still governs every write the picked ID feeds into.
 */
export async function GET(req: NextRequest) {
  const { profile } = await getAuth();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ results: [] }, { status: 403 });
  }

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const supabase = await createClient();
  const escaped = q.replace(/[%,()]/g, ' ');
  const { data, error } = await supabase
    .from('dispensaries')
    .select('id,name,city,state')
    .or(`name.ilike.%${escaped}%,city.ilike.%${escaped}%`)
    .order('name')
    .limit(20);
  if (error) return NextResponse.json({ results: [] });

  return NextResponse.json({ results: data ?? [] });
}
