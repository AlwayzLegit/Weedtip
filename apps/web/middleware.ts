import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Retired duplicate dispensary slugs (from the dedup pass) 301 to their
 * survivor. Handled in middleware — not the page — because a page-level
 * redirect() lands after generateMetadata has committed the response, so it
 * silently no-ops. An indexed PK lookup on the small dispensary_redirects
 * table is cheap and only runs for /dispensary/<slug> single-segment paths.
 */
async function dispensaryRedirect(request: NextRequest): Promise<NextResponse | null> {
  const m = /^\/dispensary\/([^/]+)$/.exec(request.nextUrl.pathname);
  if (!m) return null;
  const slug = decodeURIComponent(m[1]!);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/dispensary_redirects?old_slug=eq.${encodeURIComponent(slug)}&select=new_slug`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { new_slug: string }[];
    const to = rows[0]?.new_slug;
    if (!to || to === slug) return null;
    const dest = request.nextUrl.clone();
    dest.pathname = `/dispensary/${to}`;
    return NextResponse.redirect(dest, 301);
  } catch {
    return null;
  }
}

const US_STATE_CODES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY',
  'LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH',
  'OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]);

export async function middleware(request: NextRequest) {
  const redirect = await dispensaryRedirect(request);
  if (redirect) return redirect;

  const response = await updateSession(request);
  // Seed the market cookie from Vercel's IP geolocation on first visit, so the
  // market selector and "your state" nudges default to where the shopper is.
  if (!request.cookies.get('wt_state')) {
    const country = request.headers.get('x-vercel-ip-country');
    const region = request.headers.get('x-vercel-ip-country-region')?.toUpperCase();
    if (country === 'US' && region && US_STATE_CODES.has(region)) {
      response.cookies.set('wt_state', region, {
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
        sameSite: 'lax',
      });
    }
  }
  // City-level market ("Shopping in Pasadena" beats "Shopping in California").
  // Stored as "city|ST" so a manual state switch in the picker can't pair a
  // stale city with the wrong state — readers ignore a mismatched pair.
  if (!request.cookies.get('wt_city')) {
    const country = request.headers.get('x-vercel-ip-country');
    const region = request.headers.get('x-vercel-ip-country-region')?.toUpperCase();
    // Header value is percent-encoded ("Los%20Angeles"); keep it encoded in
    // the cookie (safe charset) and decode client-side.
    const city = request.headers.get('x-vercel-ip-city');
    if (country === 'US' && region && US_STATE_CODES.has(region) && city && city.length <= 80) {
      response.cookies.set('wt_city', `${city}|${region}`, {
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
        sameSite: 'lax',
      });
    }
  }
  // Attribution: remember when a shopper arrives from an embedded menu so the
  // eventual order can be credited to source=embed.
  if (request.nextUrl.searchParams.get('source') === 'embed') {
    response.cookies.set('wt_src', 'embed', {
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
      sameSite: 'lax',
    });
  }
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and images:
     * _next/static, _next/image, favicon, and common image/font files.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)',
  ],
};
