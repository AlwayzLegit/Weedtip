/**
 * Environment resolution for Supabase clients. Centralised so web, mobile, and
 * Edge Functions read the same variables and fail loudly when misconfigured.
 */

export interface PublicSupabaseConfig {
  url: string;
  anonKey: string;
}

function readEnv(name: string): string | undefined {
  // Works in Next.js (process.env), Node, and Deno (Edge Functions).
  if (typeof process !== 'undefined' && process.env) {
    // Client bundles only get STATICALLY referenced NEXT_PUBLIC_ vars inlined —
    // a dynamic process.env[name] lookup is always undefined in the browser, so
    // spell out the public pair before falling back to the dynamic (server) read.
    if (name === 'NEXT_PUBLIC_SUPABASE_URL') return process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (name === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
      return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    }
    if (name in process.env) return process.env[name];
  }
  const denoEnv = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno;
  return denoEnv?.env.get(name);
}

function required(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  return {
    url: required('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  };
}

/** Service-role secret. SERVER-ONLY — bypasses RLS. Never import into client bundles. */
export function getServiceRoleKey(): string {
  return required('SUPABASE_SERVICE_ROLE_KEY');
}
