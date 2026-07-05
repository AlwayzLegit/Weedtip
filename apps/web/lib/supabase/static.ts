import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getPublicSupabaseConfig } from '@weedtip/supabase/config';
import type { Database } from '@weedtip/supabase/types';

/**
 * Cookieless anon Supabase client for public, cacheable pages (ISR).
 *
 * The regular server client awaits next/headers cookies(), which forces every
 * route that touches it to render dynamically per request. Public SEO surfaces
 * (state/city directories, deals, strains, the home page) read only
 * anon-visible rows, so they use this client and `export const revalidate` to
 * serve cached HTML instead of hitting the database on every crawler hit.
 *
 * Never use this in personalized or mutating contexts — it has no session.
 */
export function createStaticClient() {
  const { url, anonKey } = getPublicSupabaseConfig();
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
