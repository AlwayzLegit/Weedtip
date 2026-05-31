/**
 * Server-side Supabase clients.
 *
 * `createServerSupabaseClient` is framework-agnostic: pass the cookie adapter from
 * your runtime (e.g. Next.js `cookies()` from `next/headers`). This keeps the shared
 * package free of a hard Next.js dependency while supporting SSR auth.
 *
 * `createAdminSupabaseClient` uses the service-role key and BYPASSES RLS — only ever
 * call it in trusted server contexts (Edge Functions, server actions, cron).
 */
import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types/database.types';
import { getPublicSupabaseConfig, getServiceRoleKey } from './config';

export function createServerSupabaseClient(cookies: CookieMethodsServer) {
  const { url, anonKey } = getPublicSupabaseConfig();
  return createServerClient<Database>(url, anonKey, { cookies });
}

export function createAdminSupabaseClient() {
  const { url } = getPublicSupabaseConfig();
  return createClient<Database>(url, getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type ServerSupabaseClient = ReturnType<typeof createServerSupabaseClient>;
export type AdminSupabaseClient = ReturnType<typeof createAdminSupabaseClient>;
