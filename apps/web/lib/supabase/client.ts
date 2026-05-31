'use client';
import { createBrowserSupabaseClient } from '@weedtip/supabase/client';

/** Supabase client for Client Components. */
export function createClient() {
  return createBrowserSupabaseClient();
}
