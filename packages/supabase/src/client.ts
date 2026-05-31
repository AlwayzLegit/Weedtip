/**
 * Browser Supabase client (anon key, RLS-enforced).
 * Use in client components / mobile webviews. Safe to expose — the anon key is public.
 */
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types/database.types';
import { getPublicSupabaseConfig } from './config';

export function createBrowserSupabaseClient() {
  const { url, anonKey } = getPublicSupabaseConfig();
  return createBrowserClient<Database>(url, anonKey);
}

export type BrowserSupabaseClient = ReturnType<typeof createBrowserSupabaseClient>;
