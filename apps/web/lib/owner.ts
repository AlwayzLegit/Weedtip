import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { Tables } from '@weedtip/supabase/types';
import { getAuth } from './auth';
import { createClient } from './supabase/server';

/**
 * Resolves the dashboard owner context: the signed-in owner/admin and their
 * primary dispensary (first owned, or null if they haven't created one yet).
 * Redirects unauthenticated or non-owner users. Memoized per request.
 *
 * Authorization is defense-in-depth: this gates the UI, while RLS enforces it
 * at the database for every read/write regardless of the client.
 */
export const getOwnerContext = cache(
  async (): Promise<{
    userId: string;
    role: Tables<'profiles'>['role'];
    dispensary: Tables<'dispensaries'> | null;
  }> => {
    const { user, profile } = await getAuth();
    if (!user) redirect('/sign-in');
    if (profile?.role !== 'dispensary_owner' && profile?.role !== 'admin') redirect('/');

    const supabase = await createClient();
    const { data: dispensary } = await supabase
      .from('dispensaries')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at')
      .limit(1)
      .maybeSingle();

    return { userId: user.id, role: profile.role, dispensary };
  },
);

/** Like getOwnerContext, but requires a dispensary to exist (redirects to create). */
export async function requireOwnerDispensary() {
  const ctx = await getOwnerContext();
  if (!ctx.dispensary) redirect('/dashboard/listing');
  return { ...ctx, dispensary: ctx.dispensary };
}
