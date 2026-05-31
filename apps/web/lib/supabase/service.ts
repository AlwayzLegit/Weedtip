import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@weedtip/supabase/types';

/**
 * Service-role Supabase client that BYPASSES RLS. Server-only — never expose the
 * service-role key to the browser. Use exclusively for trusted, unauthenticated
 * server contexts such as the Stripe webhook, where there is no user session but
 * we must still write to protected rows (e.g. mark an order paid).
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase service client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
