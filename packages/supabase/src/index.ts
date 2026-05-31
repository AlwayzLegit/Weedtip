/**
 * @weedtip/supabase — typed Supabase access for web, mobile (codegen), and Edge Functions.
 *
 * Import paths:
 *   '@weedtip/supabase'         → everything (types, queries, config)
 *   '@weedtip/supabase/client'  → browser client factory
 *   '@weedtip/supabase/server'  → SSR + admin client factories (server-only)
 *   '@weedtip/supabase/types'   → generated Database type
 */
export * from './types/database.types';
export * from './config';
export * from './queries';

// Re-export client factories for convenience (subpath imports preferred in app code
// to keep server-only code out of client bundles).
export { createBrowserSupabaseClient } from './client';
export type { BrowserSupabaseClient } from './client';
