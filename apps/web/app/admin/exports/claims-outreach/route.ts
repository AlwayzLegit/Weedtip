import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** CSV-escape: quote when the value contains a comma, quote, or newline. */
function esc(v: string | null | undefined): string {
  const s = (v ?? '').replace(/\r?\n/g, ' ');
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Admin-only CSV export of unclaimed active listings for claim outreach.
 * Tiered by best contact channel so a campaign can start with the strongest
 * segment: email (direct claim-invite campaign) > phone > website.
 * Always generated fresh from the DB — nothing is cached or stored.
 */
export async function GET() {
  const { user, profile } = await getAuth();
  if (!user || profile?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('dispensaries')
    .select('name,city,state,county,email,phone,website,license_number,slug')
    .eq('status', 'active')
    .is('owner_id', null)
    .order('state')
    .order('city')
    .order('name')
    .limit(10000);
  if (error) {
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  const header =
    'contact_tier,name,city,state,county,email,phone,website,license_number,listing_url';
  const rows = (data ?? []).map((d) => {
    const tier = d.email ? 'email' : d.phone ? 'phone' : d.website ? 'website' : 'none';
    return [
      tier,
      esc(d.name),
      esc(d.city),
      d.state,
      esc(d.county),
      esc(d.email),
      esc(d.phone),
      esc(d.website),
      esc(d.license_number),
      `https://weedtip.com/dispensary/${d.slug}`,
    ].join(',');
  });
  // Email tier first — that's the actionable campaign segment.
  const order = { email: 0, phone: 1, website: 2, none: 3 } as Record<string, number>;
  rows.sort((a, b) => (order[a.split(',', 1)[0]!] ?? 9) - (order[b.split(',', 1)[0]!] ?? 9));

  return new NextResponse([header, ...rows].join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="weedtip-claims-outreach.csv"',
    },
  });
}
