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
  if (typeof process !== 'undefined' && process.env && name in process.env) {
    return process.env[name];
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
