import 'server-only';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@weedtip/supabase/server';

/**
 * Supabase client for Server Components, Route Handlers, and Server Actions.
 * Wires Next.js cookies into the framework-agnostic factory from @weedtip/supabase.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerSupabaseClient({
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      } catch {
        // Called from a Server Component (cookies are read-only there).
        // The middleware session refresh handles writing cookies — safe to ignore.
      }
    },
  });
}
