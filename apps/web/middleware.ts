import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const US_STATE_CODES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY',
  'LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH',
  'OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]);

export async function middleware(request: NextRequest) {
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
