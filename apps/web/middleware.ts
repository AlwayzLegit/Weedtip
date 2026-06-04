import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
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
