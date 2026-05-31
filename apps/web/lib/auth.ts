import 'server-only';
import { cache } from 'react';
import type { Tables } from '@weedtip/supabase/types';
import { createClient } from './supabase/server';

/**
 * Resolves the current authenticated user and their profile. Memoized per-request
 * with React `cache` so multiple components can call it without extra round-trips.
 */
export const getAuth = cache(
  async (): Promise<{
    user: { id: string; email?: string } | null;
    profile: Tables<'profiles'> | null;
  }> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { user: null, profile: null };

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    return { user, profile };
  },
);
