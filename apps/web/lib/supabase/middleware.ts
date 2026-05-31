import { createServerClient } from '@supabase/ssr';
import { getPublicSupabaseConfig } from '@weedtip/supabase/config';
import type { Database } from '@weedtip/supabase/types';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes the Supabase auth session on every request and forwards the rotated
 * cookies to both the request (for downstream Server Components) and the response.
 * Must run in middleware — Server Components can't write cookies.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const { url, anonKey } = getPublicSupabaseConfig();
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: do not run code between createServerClient and getUser() — it
  // refreshes the token and can cause hard-to-debug random logouts otherwise.
  await supabase.auth.getUser();

  return response;
}
