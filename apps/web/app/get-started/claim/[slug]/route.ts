import { type NextRequest, NextResponse } from 'next/server';
import { ONBOARDING_COOKIE } from '@/lib/onboarding-flow';

export const dynamic = 'force-dynamic';

/**
 * Deep link into the wizard with a shop already chosen.
 *
 * This is what lets every "claim this listing" surface — the public listing
 * page, an outreach invite email, an admin share link — drop an owner into the
 * flow at the right point instead of at a search box. The wizard then decides
 * what to show: sign-up if they have no account, the claim form if they do, or
 * the status screen if they've already claimed it.
 *
 * The slug isn't validated here on purpose — a bogus one simply fails to
 * resolve, and the wizard falls back to the business picker.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const url = new URL('/get-started', _req.nextUrl.origin);
  const res = NextResponse.redirect(url);
  res.cookies.set(
    ONBOARDING_COOKIE,
    encodeURIComponent(JSON.stringify({ intent: 'dispensary', slug: slug.slice(0, 200) })),
    { path: '/', maxAge: 60 * 60 * 24 * 14, sameSite: 'lax' },
  );
  return res;
}
