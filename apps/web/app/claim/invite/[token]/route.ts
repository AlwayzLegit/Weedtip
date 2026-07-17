import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Tracked claim-invite link: stamps opened_at (via token-keyed SECURITY
 * DEFINER RPC) and lands on the shop's listing, which advertises the claim
 * flow. A dead/unknown token just goes to the listings map — never an error
 * page from a year-old email.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc('claim_invite_open', { p_token: token });
  const slug = data?.[0]?.slug;
  return NextResponse.redirect(
    new URL(slug ? `/dispensary/${slug}` : '/dispensaries', process.env.NEXT_PUBLIC_SITE_URL ?? 'https://weedtip.com'),
  );
}
